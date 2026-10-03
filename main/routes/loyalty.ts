import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { getDatabase, now, getSettingValue } from '../db';
import { stripPhoneDigits, parsePhoneE164 } from '../lib/phone';
import { parseCustomer, getWalletBalance } from './customers';
import { sendAmazonSnsSms } from '../services/amazon-sns';
import { sendLoyaltyWelcomeEmail, sendCustomerFeedbackSurveyEmail } from '../services/email-service';
import {
  sendTemplateSms,
  renderOrderInvoiceSms,
  renderLoyaltyWelcomeSms,
  renderLoyaltyPointsSms,
  renderEventPromoSms,
  renderFeedbackSurveySms,
  renderNewsletterHtml,
  broadcastSmsToCustomers,
  CAFE_BASE_URL,
} from '../services/sms-templates';

export const loyaltyRoutes = Router();

// Store active profile completion tokens in memory (also backup in memory map):
// token -> { phone, expiresAt, customerId }
interface InviteTokenEntry {
  token: string;
  phone: string;
  expiresAt: number;
  customerId?: string;
}
const inviteTokens = new Map<string, InviteTokenEntry>();

// Keep a buffer of recent sent SMS & Email messages for manager / audit display
export interface SentTextMessage {
  id: string;
  type: 'loyalty_invite' | 'loyalty_welcome_email' | 'order_notification' | 'survey_email' | 'general';
  recipient: string; // phone or email
  customerName?: string;
  orderNumber?: string;
  message: string;
  timestamp: string;
  status: 'delivered' | 'sent';
  provider?: string;
}
const recentMessages: SentTextMessage[] = [];

/**
 * 1. Customer Lookup by Phone
 * If customer exists (with confirmed profile), returns full profile.
 */
loyaltyRoutes.get('/lookup', (req: Request, res: Response) => {
  try {
    const rawPhone = String(req.query.phone || '').trim();
    const digits = stripPhoneDigits(rawPhone);
    if (!digits || digits.length < 3) {
      return res.status(400).json({ error: 'Phone number must have at least 3 digits' });
    }

    const db = getDatabase();
    const customer = db.prepare(`
      SELECT * FROM customers 
      WHERE is_active = 1 AND phone_digits LIKE ?
      ORDER BY created_at ASC
      LIMIT 1
    `).get(`%${digits}%`) as any;

    if (!customer) {
      return res.json({ exists: false });
    }

    const walletBalance = getWalletBalance(customer.id);
    const orderStats = db.prepare(`
      SELECT COUNT(*) as visits_count, COALESCE(SUM(total), 0) as total_spent, MAX(created_at) as last_visit_at
      FROM orders WHERE customer_id = ?
    `).get(customer.id) as any;

    // Split name into first and last if possible
    const nameParts = (customer.name || '').trim().split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    return res.json({
      exists: true,
      customer: {
        ...parseCustomer(customer),
        first_name: firstName,
        last_name: lastName,
        wallet_balance: walletBalance,
        visits_count: orderStats?.visits_count || 0,
        total_spent: orderStats?.total_spent || 0,
        last_visit_at: orderStats?.last_visit_at || null,
      },
    });
  } catch (error: any) {
    console.error('[Loyalty lookup error]', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * 2. Send Loyalty Invite via Amazon SNS SMS
 * Text: "Thank you for joining Hourglass the Cafe's Loyalty Program! Click here to complete your profile: [Link]"
 */
loyaltyRoutes.post('/send-invite', async (req: Request, res: Response) => {
  try {
    const { phone } = req.body;
    if (!phone || !String(phone).trim()) {
      return res.status(400).json({ error: 'Phone number is required' });
    }

    const db = getDatabase();
    const tenantCountry = getSettingValue('country') || 'IN';
    const parsed = parsePhoneE164(String(phone).trim(), tenantCountry);
    const finalPhone = parsed ? parsed.e164 : String(phone).trim();
    const digits = stripPhoneDigits(finalPhone);
    const countryCode = parsed ? parsed.countryCode : '+91';

    // Check if customer already exists
    let customer = db.prepare('SELECT * FROM customers WHERE is_active = 1 AND phone_digits = ?').get(digits) as any;
    let customerId: string;

    if (!customer) {
      customerId = `cust-${randomUUID()}`;
      const nowTs = now();
      db.prepare(`
        INSERT INTO customers (id, phone, name, country_code, notes, created_at, updated_at)
        VALUES (?, ?, 'New Loyalty Member', ?, 'Loyalty Registration Pending', ?, ?)
      `).run(customerId, finalPhone, countryCode, nowTs, nowTs);
      customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(customerId) as any;
    } else {
      customerId = customer.id;
    }

    // Generate Profile Completion Token
    const token = randomUUID();
    inviteTokens.set(token, {
      token,
      phone: finalPhone,
      customerId,
      expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24 hours valid
    });

    const baseUrl = 'https://pos.15.207.179.83.nip.io';
    const profileLink = `${baseUrl}/loyalty/join?token=${token}&phone=${encodeURIComponent(finalPhone)}`;

    // Exact text format requested by user:
    // "Thank you for joining Hourglass the Cafe's Loyalty Program! Click here to complete your profile: [Link]"
    const textMessage = `Thank you for joining Hourglass the Cafe's Loyalty Program! Click here to complete your profile: ${profileLink}`;

    // Dispatch via Amazon SNS SMS service
    const smsResult = await sendAmazonSnsSms(finalPhone, textMessage);

    // Record in recent messages
    const msgRecord: SentTextMessage = {
      id: smsResult.messageId,
      type: 'loyalty_invite',
      recipient: finalPhone,
      message: textMessage,
      timestamp: new Date().toISOString(),
      status: 'delivered',
      provider: smsResult.provider,
    };
    recentMessages.unshift(msgRecord);
    if (recentMessages.length > 100) recentMessages.pop();

    return res.json({
      success: true,
      phone: finalPhone,
      token,
      profileLink,
      message: textMessage,
      provider: smsResult.provider,
      customer: parseCustomer(customer),
    });
  } catch (error: any) {
    console.error('[Loyalty send-invite error]', error);
    res.status(500).json({ error: 'Failed to send loyalty invitation via Amazon SNS' });
  }
});

/**
 * 3. Validate Token / Get Join Info (For customer web page)
 */
loyaltyRoutes.get('/join-info', (req: Request, res: Response) => {
  try {
    const { token, phone } = req.query;
    let targetPhone = String(phone || '').trim();

    if (token) {
      const entry = inviteTokens.get(String(token).trim());
      if (entry) {
        targetPhone = entry.phone;
      }
    }

    const db = getDatabase();
    let existingCustomer: any = null;
    if (targetPhone) {
      const digits = stripPhoneDigits(targetPhone);
      existingCustomer = db.prepare('SELECT * FROM customers WHERE is_active = 1 AND phone_digits = ?').get(digits);
    }

    res.json({
      valid: true,
      phone: targetPhone || '',
      customer: existingCustomer ? parseCustomer(existingCustomer) : null,
      cafe: {
        name: 'Hourglass Cafe',
        tagline: 'Taste The Rhythm of Time',
        phone: '+91 96431 77506',
        instagram: '@the_hourglasscafe',
        welcomeBonus: 50,
      },
    });
  } catch (error: any) {
    console.error('[Join-info error]', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * 4. Complete Loyalty Profile (Customer Web Form Submission)
 * Fields: First Name, Last Name, Phone Number (Auto-filled), Email Address
 * Action: Updates DB, awards 50 points, dispatches welcome email to filled email address.
 */
loyaltyRoutes.post('/complete-profile', async (req: Request, res: Response) => {
  try {
    const {
      first_name,
      last_name,
      phone,
      email,
      token,
      favorite_coffee,
      birthday,
    } = req.body;

    const firstName = String(first_name || '').trim();
    const lastName = String(last_name || '').trim();
    const rawEmail = String(email || '').trim().toLowerCase();
    const rawPhone = String(phone || '').trim();

    if (!firstName) {
      return res.status(400).json({ error: 'First Name is required' });
    }
    if (!lastName) {
      return res.status(400).json({ error: 'Last Name is required' });
    }
    if (!rawPhone) {
      return res.status(400).json({ error: 'Phone Number is required' });
    }
    if (!rawEmail || !rawEmail.includes('@') || !rawEmail.includes('.')) {
      return res.status(400).json({ error: 'Valid Email Address is required' });
    }

    const fullName = `${firstName} ${lastName}`.trim();
    const db = getDatabase();
    const tenantCountry = getSettingValue('country') || 'IN';
    const parsed = parsePhoneE164(rawPhone, tenantCountry);
    const finalPhone = parsed ? parsed.e164 : rawPhone;
    const digits = stripPhoneDigits(finalPhone);
    const countryCode = parsed ? parsed.countryCode : '+91';

    let customer = db.prepare('SELECT * FROM customers WHERE is_active = 1 AND phone_digits = ?').get(digits) as any;
    const nowTs = now();
    let customerId: string;

    if (customer) {
      customerId = customer.id;
      db.prepare(`
        UPDATE customers 
        SET name = ?, email = ?, notes = 'Loyalty Member (Email & Phone Verified)', updated_at = ?
        WHERE id = ?
      `).run(fullName, rawEmail, nowTs, customerId);
    } else {
      customerId = `cust-${randomUUID()}`;
      db.prepare(`
        INSERT INTO customers (id, phone, name, email, country_code, notes, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, 'Loyalty Member (Email & Phone Verified)', ?, ?)
      `).run(customerId, finalPhone, fullName, rawEmail, countryCode, nowTs, nowTs);
    }

    // Award 50 welcome bonus loyalty points if not awarded yet
    const existingBonus = db.prepare(`
      SELECT id FROM loyalty_ledger 
      WHERE customer_id = ? AND description LIKE '%Welcome bonus%'
    `).get(customerId);

    if (!existingBonus) {
      db.prepare(`
        INSERT INTO loyalty_ledger (customer_id, type, amount, description, created_at, updated_at)
        VALUES (?, 'credit', 50, 'Welcome bonus for completing Hourglass Loyalty Profile', ?, ?)
      `).run(customerId, nowTs, nowTs);
    }

    // Delete token from active map
    if (token) {
      inviteTokens.delete(String(token).trim());
    }

    const updatedCustomer = db.prepare('SELECT * FROM customers WHERE id = ?').get(customerId) as any;
    const walletBalance = getWalletBalance(customerId);

    // Send confirmation email to the filled email address!
    const emailResult = await sendLoyaltyWelcomeEmail(rawEmail, {
      firstName,
      lastName,
      phone: finalPhone,
      points: 50,
      customerId,
    });

    // Record email in audit log
    const emailRecord: SentTextMessage = {
      id: emailResult.messageId,
      type: 'loyalty_welcome_email',
      recipient: rawEmail,
      customerName: fullName,
      message: `Welcome email with 50 points bonus sent to ${rawEmail}`,
      timestamp: new Date().toISOString(),
      status: 'delivered',
    };
    recentMessages.unshift(emailRecord);

    return res.json({
      success: true,
      message: `🎉 Loyalty profile confirmed! Welcome email sent to ${rawEmail}.`,
      customer: {
        ...parseCustomer(updatedCustomer),
        first_name: firstName,
        last_name: lastName,
        wallet_balance: walletBalance,
      },
      welcome_points: 50,
    });
  } catch (error: any) {
    console.error('[Complete profile error]', error);
    res.status(500).json({ error: 'Failed to complete loyalty profile' });
  }
});

/**
 * 5. Send Customer Feedback / Survey to Verified Email Address
 */
loyaltyRoutes.post('/send-survey', async (req: Request, res: Response) => {
  try {
    const { customer_id, email, order_number } = req.body;
    const db = getDatabase();

    let targetEmail = email;
    let firstName = 'Valued Guest';

    if (customer_id) {
      const cust = db.prepare('SELECT * FROM customers WHERE id = ?').get(customer_id) as any;
      if (cust) {
        targetEmail = cust.email || targetEmail;
        firstName = (cust.name || '').split(' ')[0] || firstName;
      }
    }

    if (!targetEmail || !targetEmail.includes('@')) {
      return res.status(400).json({ error: 'Valid customer email is required' });
    }

    const surveyResult = await sendCustomerFeedbackSurveyEmail(targetEmail, {
      firstName,
      orderNumber: order_number,
    });

    const surveyRecord: SentTextMessage = {
      id: surveyResult.messageId,
      type: 'survey_email',
      recipient: targetEmail,
      customerName: firstName,
      orderNumber: order_number,
      message: `Customer experience survey email sent to ${targetEmail}`,
      timestamp: new Date().toISOString(),
      status: 'delivered',
    };
    recentMessages.unshift(surveyRecord);

    res.json({
      success: true,
      recipient: targetEmail,
      message: `Feedback survey dispatched to verified email ${targetEmail}`,
    });
  } catch (error: any) {
    console.error('[Send survey error]', error);
    res.status(500).json({ error: 'Failed to send feedback survey' });
  }
});

/**
 * 6. Send Order Status SMS
 */
loyaltyRoutes.post('/send-order-sms', async (req: Request, res: Response) => {
  try {
    const { order_id, order_number, phone, wait_time } = req.body;
    const db = getDatabase();

    let order: any = null;
    if (order_id) {
      order = db.prepare('SELECT * FROM orders WHERE id = ?').get(order_id);
    } else if (order_number) {
      order = db.prepare('SELECT * FROM orders WHERE order_number = ?').get(order_number);
    }

    const orderNum = order?.order_number || order_number || 'HG-ORDER';
    const waitingTime = wait_time || '15-20 minutes';
    const targetPhone = phone || (order?.customer_id ? (db.prepare('SELECT phone FROM customers WHERE id = ?').get(order.customer_id) as any)?.phone : null) || '+91 96431 77506';

    const baseUrl = 'https://pos.15.207.179.83.nip.io';
    const paymentLink = `${baseUrl}/order?status=${orderNum}#pay`;

    // Exact text message requested by user
    const textMessage = `Hi, Your order at Hourglass cafe will ready in ${waitingTime}, You can settle the bill here (${paymentLink}) or at the counter with cash/UPI/Credit card/Debit Card, Post payment your invoice will be generated`;

    const smsResult = await sendAmazonSnsSms(targetPhone, textMessage);

    const msgRecord: SentTextMessage = {
      id: smsResult.messageId,
      type: 'order_notification',
      recipient: targetPhone,
      orderNumber: orderNum,
      message: textMessage,
      timestamp: new Date().toISOString(),
      status: 'delivered',
      provider: smsResult.provider,
    };
    recentMessages.unshift(msgRecord);
    if (recentMessages.length > 100) recentMessages.pop();

    return res.json({
      success: true,
      phone: targetPhone,
      orderNumber: orderNum,
      waitingTime,
      paymentLink,
      message: textMessage,
    });
  } catch (error: any) {
    console.error('[Send order sms error]', error);
    res.status(500).json({ error: 'Failed to send order notification' });
  }
});

/**
 * 7. Recent SMS & Email Notification Log
 */
loyaltyRoutes.get('/messages', (_req: Request, res: Response) => {
  res.json({ messages: recentMessages });
});

/**
 * 8. Templates Catalog (SMS & Email)
 */
loyaltyRoutes.get('/templates', (_req: Request, res: Response) => {
  res.json({
    smsTemplates: [
      {
        id: 'order_invoice',
        name: 'Online Order Invoice & Confirmation',
        description: 'Sent after an online order is placed or bill generated with direct download invoice link.',
        variables: ['customerName', 'orderNumber', 'itemsSummary', 'totalAmount', 'estimatedPrepTime', 'invoiceUrl'],
        sample: renderOrderInvoiceSms({
          customerName: 'Aditya',
          orderNumber: 'HG-1003-001',
          itemsSummary: '2x Paneerzilla Burger, 1x Hazelnut Frappe',
          totalAmount: 430,
          estimatedPrepTime: '15-20 minutes',
          invoiceUrl: `${CAFE_BASE_URL}/api/public/invoice/HG-1003-001`,
        }),
      },
      {
        id: 'loyalty_welcome',
        name: 'Loyalty Program Welcome & Bonus Points',
        description: 'Sent when customer joins or earns initial bonus points with link to digital loyalty card.',
        variables: ['customerName', 'phoneNumber', 'welcomePoints', 'loyaltyUrl'],
        sample: renderLoyaltyWelcomeSms({
          customerName: 'Priya',
          phoneNumber: '+919876543210',
          welcomePoints: 50,
          loyaltyUrl: `${CAFE_BASE_URL}/loyalty/join?phone=%2B919876543210`,
        }),
      },
      {
        id: 'loyalty_points',
        name: 'Loyalty Points Earned on Order',
        description: 'Sent after an order is settled to notify customer of points earned and current balance.',
        variables: ['customerName', 'orderNumber', 'pointsEarned', 'totalPoints', 'pointsValueRupees', 'loyaltyUrl'],
        sample: renderLoyaltyPointsSms({
          customerName: 'Rohan',
          orderNumber: 'HG-1003-005',
          pointsEarned: 25,
          totalPoints: 125,
          pointsValueRupees: 62.5,
          loyaltyUrl: `${CAFE_BASE_URL}/order`,
        }),
      },
      {
        id: 'event_promo',
        name: 'Event Promotion & Specials Broadcast',
        description: 'Sent to consented customers for upcoming cafe events, weekend specials, or seasonal discounts.',
        variables: ['eventTitle', 'offerDescription', 'offerCode', 'expiryDate', 'orderUrl'],
        sample: renderEventPromoSms({
          eventTitle: 'Weekend Frappe & Burger Fiesta',
          offerDescription: 'Get a FREE Hazelnut Frappe with any 2 Gourmet Burgers!',
          offerCode: 'WEEKEND50',
          expiryDate: 'Sunday 11:00 PM',
          orderUrl: `${CAFE_BASE_URL}/order`,
        }),
      },
      {
        id: 'feedback_survey',
        name: 'Post-Visit Customer Feedback & Rating',
        description: 'Sent after dining to collect review ratings and award bonus points.',
        variables: ['customerName', 'orderNumber', 'feedbackUrl', 'bonusPoints'],
        sample: renderFeedbackSurveySms({
          customerName: 'Aarav',
          orderNumber: 'HG-1003-002',
          feedbackUrl: `${CAFE_BASE_URL}/feedback`,
          bonusPoints: 20,
        }),
      },
    ],
    emailTemplates: [
      {
        id: 'loyalty_welcome_email',
        name: 'Loyalty Member Digital Card & Welcome Email',
        subject: 'Welcome to Hourglass Cafe Loyalty Program! ☕✨',
      },
      {
        id: 'newsletter_event_email',
        name: 'Events & Seasonal Specials Newsletter',
        subject: 'Special Happenings at Hourglass Cafe 🍕🎉',
      },
    ],
  });
});

/**
 * 9. Send Single SMS by Template
 */
loyaltyRoutes.post('/campaigns/send-sms', async (req: Request, res: Response) => {
  try {
    const { phone, template, data } = req.body;
    if (!phone || !template) {
      return res.status(400).json({ error: 'Phone number and template name are required' });
    }

    const result = await sendTemplateSms(phone, template, data || {});
    return res.json({ success: true, result });
  } catch (error: any) {
    console.error('[Send template SMS error]', error);
    res.status(500).json({ error: error.message || 'Failed to send template SMS' });
  }
});

/**
 * 10. Broadcast SMS Campaign to Consented Customers
 */
loyaltyRoutes.post('/campaigns/broadcast-sms', async (req: Request, res: Response) => {
  try {
    const { template = 'event_promo', data } = req.body;
    if (!data) return res.status(400).json({ error: 'Campaign data payload is required' });

    const broadcastRes = await broadcastSmsToCustomers(template, data);
    return res.json({
      success: true,
      message: `Broadcast sent to ${broadcastRes.totalRecipients} customers`,
      ...broadcastRes,
    });
  } catch (error: any) {
    console.error('[Broadcast SMS error]', error);
    res.status(500).json({ error: error.message || 'Failed to broadcast SMS' });
  }
});

