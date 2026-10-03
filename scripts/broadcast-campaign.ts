#!/usr/bin/env ts-node
/**
 * CLI Tool: Broadcast SMS / Newsletter Campaign to Registered & Consented Customers
 * 
 * Usage:
 *   npx ts-node scripts/broadcast-campaign.ts --template=event_promo --title="Weekend Burger & Shake Fest" --offer="Flat 25% Off on all Burgers & Shakes" --code="FEAST25" --expiry="Sunday 11 PM"
 *   npx ts-node scripts/broadcast-campaign.ts --template=loyalty_welcome --points=50
 */

import { getDatabase, initDatabase } from '../main/db';
import { broadcastSmsToCustomers, CAFE_BASE_URL } from '../main/services/sms-templates';

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
  const template = (args.template || 'event_promo') as any;

  console.log(`\n📢 Hourglass Cafe - Campaign Broadcast Tool`);
  console.log(`===================================================`);

  const db = getDatabase();
  const customerCountRow = db.prepare(`
    SELECT COUNT(*) as count FROM customers 
    WHERE is_active = 1 AND phone IS NOT NULL AND phone != ''
  `).get() as { count: number };

  const total = customerCountRow?.count || 0;
  console.log(`👥 Found ${total} registered customers with verified phone numbers.\n`);

  if (total === 0) {
    console.log(`No active customers found in the database.`);
    process.exit(0);
  }

  let campaignData: any = {};
  if (template === 'event_promo') {
    campaignData = {
      eventTitle: args.title || 'Weekend Delights & Frappe Fest',
      offerDescription: args.offer || 'Get a complimentary beverage with any Gourmet Burger!',
      offerCode: args.code || 'WEEKENDVIP',
      expiryDate: args.expiry || 'This Sunday',
      orderUrl: `${CAFE_BASE_URL}/order`,
    };
  } else if (template === 'loyalty_welcome') {
    campaignData = {
      welcomePoints: Number(args.points) || 50,
      loyaltyUrl: `${CAFE_BASE_URL}/loyalty/join`,
    };
  }

  console.log(`🚀 Starting Broadcast for template: '${template}'...`);
  const startTime = Date.now();

  try {
    const outcome = await broadcastSmsToCustomers(template, campaignData);
    const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log(`\n🎉 Campaign Broadcast Completed in ${elapsedSec}s!`);
    console.log(`• Total Recipients: ${outcome.totalRecipients}`);
    console.log(`• Successfully Delivered / Queued: ${outcome.results.length}`);
    console.log(`\nSample Message Dispatched:\n${'='.repeat(45)}\n${outcome.results[0]?.message || 'N/A'}\n${'='.repeat(45)}\n`);
  } catch (err: any) {
    console.error(`\n❌ Broadcast failed:`, err.message || err);
    process.exit(1);
  }
}

main();
