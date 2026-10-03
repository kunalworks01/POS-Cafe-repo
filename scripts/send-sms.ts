#!/usr/bin/env ts-node
/**
 * CLI Tool: Send Template SMS to Customers
 * 
 * Usage:
 *   npx ts-node scripts/send-sms.ts --template=order_invoice --phone=+919876543210 --order=HG-1003-001 --amount=350 --items="1x Burger, 1x Frappe"
 *   npx ts-node scripts/send-sms.ts --template=loyalty_welcome --phone=+919876543210 --name="Aditya" --points=50
 *   npx ts-node scripts/send-sms.ts --template=event_promo --phone=+919876543210 --title="Weekend Burger Fiesta" --offer="Get 20% off with code WEEKEND20"
 */

import { sendTemplateSms, renderOrderInvoiceSms, renderLoyaltyWelcomeSms, renderLoyaltyPointsSms, renderEventPromoSms, renderFeedbackSurveySms, CAFE_BASE_URL } from '../main/services/sms-templates';
import { initDatabase } from '../main/db';

try {
  initDatabase();
} catch (_) {}

function parseArgs(): Record<string, string> {
  const args = process.argv.slice(2);
  const result: Record<string, string> = {};
  for (const arg of args) {
    if (arg.startsWith('--')) {
      const [key, ...vals] = arg.slice(2).split('=');
      result[key] = vals.join('=');
    }
  }
  return result;
}

async function main() {
  const args = parseArgs();
  const phone = args.phone || args.to;
  const template = (args.template || 'order_invoice') as any;

  if (!phone) {
    console.log(`
📱 Hourglass Cafe - SMS Dispatch CLI Tool
===================================================
Usage Examples:

1. Send Online Order Invoice Link:
   npx ts-node scripts/send-sms.ts --template=order_invoice --phone=+919876543210 --order=HG-1003-001 --amount=430 --items="2x Paneerzilla Burger"

2. Send Loyalty Program Welcome:
   npx ts-node scripts/send-sms.ts --template=loyalty_welcome --phone=+919876543210 --name="Priya" --points=50

3. Send Event / Promo Broadcast:
   npx ts-node scripts/send-sms.ts --template=event_promo --phone=+919876543210 --title="Weekend Frappe Fiesta" --offer="Buy 1 Get 1 Free on all Shakes" --expiry="Sunday"

4. Send Post-Visit Feedback Survey:
   npx ts-node scripts/send-sms.ts --template=feedback_survey --phone=+919876543210 --name="Rohan" --order=HG-1003-005
    `);
    process.exit(1);
  }

  console.log(`\n⏳ Dispatching '${template}' SMS to ${phone}...`);

  let data: any = {};
  if (template === 'order_invoice') {
    const orderNum = args.order || 'HG-1003-001';
    data = {
      customerName: args.name,
      orderNumber: orderNum,
      itemsSummary: args.items || 'Gourmet Burger & Thick Shake',
      totalAmount: args.amount || '350',
      estimatedPrepTime: args.prep || '15-20 minutes',
      invoiceUrl: `${CAFE_BASE_URL}/api/public/invoice/${orderNum}`,
    };
  } else if (template === 'loyalty_welcome') {
    data = {
      customerName: args.name || 'Valued Customer',
      phoneNumber: phone,
      welcomePoints: Number(args.points) || 50,
      loyaltyUrl: `${CAFE_BASE_URL}/loyalty/join?phone=${encodeURIComponent(phone)}`,
    };
  } else if (template === 'loyalty_points') {
    data = {
      customerName: args.name || 'Valued Member',
      orderNumber: args.order || 'HG-1003-001',
      pointsEarned: Number(args.earned) || 20,
      totalPoints: Number(args.total_points) || 120,
      pointsValueRupees: Number(args.value) || 60,
      loyaltyUrl: `${CAFE_BASE_URL}/order`,
    };
  } else if (template === 'event_promo') {
    data = {
      eventTitle: args.title || 'Special Celebration at Hourglass Cafe',
      offerDescription: args.offer || 'Enjoy exclusive seasonal delicacies & beverages today!',
      offerCode: args.code || 'CAFE20',
      expiryDate: args.expiry || 'This Weekend',
      orderUrl: `${CAFE_BASE_URL}/order`,
    };
  } else if (template === 'feedback_survey') {
    data = {
      customerName: args.name,
      orderNumber: args.order,
      feedbackUrl: `${CAFE_BASE_URL}/feedback`,
      bonusPoints: 20,
    };
  }

  try {
    const result = await sendTemplateSms(phone, template, data);
    console.log(`\n✅ SMS Dispatched Successfully!`);
    console.log(`• Message ID: ${result.messageId}`);
    console.log(`• Provider:   ${result.provider}`);
    console.log(`• Recipient:  ${result.phoneNumber}`);
    console.log(`\n📝 Message Body:\n${'='.repeat(45)}\n${result.message}\n${'='.repeat(45)}\n`);
  } catch (err: any) {
    console.error(`\n❌ Error sending SMS:`, err.message || err);
    process.exit(1);
  }
}

main();
