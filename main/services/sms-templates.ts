import { getDatabase } from '../db';
import { sendAmazonSnsSms, type SendSmsResult } from './amazon-sns';

export const CAFE_BASE_URL = 'https://pos.15.207.179.83.nip.io';
export const CAFE_NAME = 'Hourglass Cafe';
export const CAFE_TAGLINE = 'Taste The Rhythm of Time';
export const CAFE_PHONE = '+91 96431 77506';

export interface OrderInvoiceData {
  customerName?: string;
  orderNumber: string;
  itemsSummary?: string;
  totalAmount: number | string;
  estimatedPrepTime?: string;
  invoiceUrl?: string;
}

export interface LoyaltyWelcomeData {
  customerName?: string;
  phoneNumber: string;
  welcomePoints: number;
  loyaltyUrl?: string;
}

export interface LoyaltyPointsUpdateData {
  customerName?: string;
  orderNumber: string;
  pointsEarned: number;
  totalPoints: number;
  pointsValueRupees: number;
  loyaltyUrl?: string;
}

export interface EventPromoData {
  eventTitle: string;
  offerDescription: string;
  offerCode?: string;
  expiryDate?: string;
  orderUrl?: string;
}

export interface FeedbackSurveyData {
  customerName?: string;
  orderNumber?: string;
  feedbackUrl?: string;
  bonusPoints?: number;
}

export interface NewsletterEmailData {
  subject: string;
  headline: string;
  contentHtml: string;
  buttonText?: string;
  buttonUrl?: string;
  specialOffer?: string;
}

/**
 * 1. Template: Online Order Confirmation & Digital Invoice Link (Requested by User)
 */
export function renderOrderInvoiceSms(data: OrderInvoiceData): string {
  const url = data.invoiceUrl || `${CAFE_BASE_URL}/api/public/invoice/${data.orderNumber}`;
  const prep = data.estimatedPrepTime || '15-20 minutes';
  const nameGreeting = data.customerName ? `Hi ${data.customerName}, ` : 'Hi, ';

  return `${nameGreeting}Thank you for choosing Hourglass Cafe for your favorite foods and beverages! ⏳🍔☕

Here are your order details:
• Order #: ${data.orderNumber}
${data.itemsSummary ? `• Items: ${data.itemsSummary}\n` : ''}• Total Amount: ₹${data.totalAmount}
• Ready In: ${prep}

To view, save, or download your digital tax invoice, please click the link below:
${url}

We look forward to serving you!`;
}

/**
 * 2. Template: Loyalty Program Welcome
 */
export function renderLoyaltyWelcomeSms(data: LoyaltyWelcomeData): string {
  const url = data.loyaltyUrl || `${CAFE_BASE_URL}/loyalty/join?phone=${encodeURIComponent(data.phoneNumber)}`;
  const greeting = data.customerName ? `Hi ${data.customerName}, ` : 'Hi, ';

  return `${greeting}Welcome to the Hourglass Cafe Loyalty Club! 🎉✨

You have been credited with ${data.welcomePoints} bonus loyalty points!

Complete your profile to unlock exclusive member perks & digital card:
${url}

Earn reward points on every order redeemable for delicious treats!`;
}

/**
 * 3. Template: Loyalty Points Balance Update
 */
export function renderLoyaltyPointsSms(data: LoyaltyPointsUpdateData): string {
  const url = data.loyaltyUrl || `${CAFE_BASE_URL}/order`;
  const greeting = data.customerName ? `Hi ${data.customerName}! ` : 'Hi! ';

  return `${greeting}Hourglass Cafe Rewards Update ✨

You just earned +${data.pointsEarned} loyalty points on Order #${data.orderNumber}!
Your Total Balance: ${data.totalPoints} points (₹${data.pointsValueRupees} discount value).

Redeem on your next visit or order online:
${url}`;
}

/**
 * 4. Template: Event / Specials / Newsletter Broadcast SMS
 */
export function renderEventPromoSms(data: EventPromoData): string {
  const url = data.orderUrl || `${CAFE_BASE_URL}/order`;
  const promo = data.offerCode ? ` Use Code: ${data.offerCode}.` : '';
  const expiry = data.expiryDate ? ` Valid until ${data.expiryDate}.` : '';

  return `🎉 Special from Hourglass Cafe: ${data.eventTitle}!

${data.offerDescription}${promo}${expiry}

Order online for fast takeaway or visit us today:
${url}

Reply STOP to opt out.`;
}

/**
 * 5. Template: Customer Feedback Survey
 */
export function renderFeedbackSurveySms(data: FeedbackSurveyData): string {
  const url = data.feedbackUrl || `${CAFE_BASE_URL}/feedback`;
  const points = data.bonusPoints || 20;

  return `Thank you for visiting Hourglass Cafe! ⭐

How was your food and beverage experience today? Rate us in 30 seconds & get ${points} bonus loyalty points:
${url}`;
}

/**
 * 6. Rich HTML Email Newsletter Template
 */
export function renderNewsletterHtml(data: NewsletterEmailData, customerName = 'Valued Customer'): string {
  const btnText = data.buttonText || 'Explore Menu & Order Online';
  const btnUrl = data.buttonUrl || `${CAFE_BASE_URL}/order`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${data.subject}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f7f5f2; margin: 0; padding: 20px; color: #2c2523; }
    .wrapper { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 8px 30px rgba(0,0,0,0.06); border: 1px solid #e8e2dc; }
    .header { background: linear-gradient(135deg, #2b1e1a 0%, #4a342c 100%); color: #ffffff; padding: 36px 24px; text-align: center; }
    .header h1 { margin: 0 0 6px 0; font-size: 26px; letter-spacing: 2px; color: #f5e6d3; }
    .header p { margin: 0; font-size: 13px; letter-spacing: 1px; color: #d4a373; text-transform: uppercase; font-weight: 600; }
    .body { padding: 32px 28px; line-height: 1.6; }
    .headline { font-size: 20px; font-weight: 800; color: #2b1e1a; margin-bottom: 16px; }
    .offer-box { background: #faf4ed; border: 2px dashed #d4a373; border-radius: 12px; padding: 20px; text-align: center; margin: 24px 0; }
    .offer-title { font-size: 18px; font-weight: 800; color: #9a6943; margin-bottom: 4px; }
    .cta-btn { display: inline-block; background: #9a6943; color: #ffffff !important; padding: 14px 32px; border-radius: 10px; text-decoration: none; font-weight: 700; font-size: 15px; margin: 20px 0 10px 0; }
    .footer { background: #fdfbf7; padding: 24px 28px; text-align: center; font-size: 12px; color: #9c928a; border-top: 1px solid #ede7df; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <h1>HOURGLASS CAFE</h1>
      <p>${CAFE_TAGLINE}</p>
    </div>
    <div class="body">
      <div class="headline">Hello ${customerName}! 👋</div>
      <p style="font-size: 15px; color: #4a3e39;">${data.headline}</p>
      
      ${data.specialOffer ? `
      <div class="offer-box">
        <div class="offer-title">🎁 EXCLUSIVE OFFER</div>
        <div style="font-size: 14px; color: #6b5e59;">${data.specialOffer}</div>
      </div>` : ''}

      <div style="font-size: 14px; color: #4a3e39; margin: 20px 0;">
        ${data.contentHtml}
      </div>

      <div style="text-align: center;">
        <a href="${btnUrl}" class="cta-btn">${btnText}</a>
      </div>
    </div>
    <div class="footer">
      <p><strong>Hourglass Cafe</strong> · C-42, Shastri Nagar, Ghaziabad, UP · ${CAFE_PHONE}</p>
      <p>Follow us on Instagram: <strong>@the_hourglasscafe</strong></p>
      <p style="margin-top: 12px; font-size: 11px;">You received this because you consented to updates from Hourglass Cafe. To unsubscribe, reply STOP.</p>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Dispatch an SMS by template type
 */
export async function sendTemplateSms(
  phoneNumber: string,
  templateType: 'order_invoice' | 'loyalty_welcome' | 'loyalty_points' | 'event_promo' | 'feedback_survey',
  data: any
): Promise<SendSmsResult> {
  let message = '';
  switch (templateType) {
    case 'order_invoice':
      message = renderOrderInvoiceSms(data);
      break;
    case 'loyalty_welcome':
      message = renderLoyaltyWelcomeSms(data);
      break;
    case 'loyalty_points':
      message = renderLoyaltyPointsSms(data);
      break;
    case 'event_promo':
      message = renderEventPromoSms(data);
      break;
    case 'feedback_survey':
      message = renderFeedbackSurveySms(data);
      break;
    default:
      throw new Error(`Unknown template type: ${templateType}`);
  }

  return await sendAmazonSnsSms(phoneNumber, message);
}

/**
 * Broadcast SMS Campaign to all registered customers with phone numbers
 */
export async function broadcastSmsToCustomers(
  templateType: 'event_promo' | 'loyalty_welcome',
  data: any
): Promise<{ totalRecipients: number; results: SendSmsResult[] }> {
  const db = getDatabase();
  const customers = db.prepare(`
    SELECT id, name, phone FROM customers 
    WHERE is_active = 1 AND phone IS NOT NULL AND phone != ''
  `).all() as Array<{ id: string; name: string; phone: string }>;

  const results: SendSmsResult[] = [];
  for (const customer of customers) {
    try {
      const personalizedData = { ...data, customerName: customer.name, phoneNumber: customer.phone };
      const res = await sendTemplateSms(customer.phone, templateType, personalizedData);
      results.push(res);
    } catch (err) {
      console.warn(`[SMS Broadcast] Failed to send to ${customer.phone}:`, err);
    }
  }

  return { totalRecipients: customers.length, results };
}
