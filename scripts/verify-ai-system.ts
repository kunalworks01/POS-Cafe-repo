import { initDatabase } from '../main/db';
import {
  generateCartRecommendations,
  generateStrategicGrowthAnalysis,
  generateMarketingCampaign,
  enhanceMenuDescription,
  askGeminiAdvisor,
} from '../main/services/gemini-ai';
import { generateIntelligenceReport } from '../main/services/ai-advisor';

async function main() {
  console.log('🚀 Running Complete End-to-End Gemini AI System Verification...');
  initDatabase();

  // 1. Intelligence Report & Strategic Audit
  console.log('\n📊 Step 1: Base Intelligence & Gemini Strategic Audit...');
  const baseReport = generateIntelligenceReport(14);
  console.log(`- Base Report Period: ${baseReport.period}`);
  console.log(`- Total Orders: ${baseReport.summary.total_orders}, Gross: ₹${baseReport.summary.total_revenue}`);

  const geminiAudit = await generateStrategicGrowthAnalysis(baseReport);
  console.log(`- Gemini Health Score: ${geminiAudit.healthScore}/100`);
  console.log(`- Executive Summary: ${geminiAudit.executiveSummary}`);
  console.log(`- Growth Experiments Count: ${geminiAudit.growthExperiments.length}`);

  // 2. Real-time POS Upsell Recommendations
  console.log('\n🍔 Step 2: Real-time POS Cart Recommendation Engine...');
  const posRecs = await generateCartRecommendations({
    cartItems: [
      { name: 'Paneerzilla Burger', price: 180, quantity: 1, category: 'Burgers' },
      { name: 'Peri Peri Fries', price: 120, quantity: 1, category: 'Appetizers' },
    ],
    customerName: 'Aman Verma',
    loyaltyPoints: 120,
    timeOfDay: 'afternoon tea & snack time',
  });
  console.log(`- Staff Pitch: "${posRecs.staffPitchScript}"`);
  console.log(`- Loyalty Incentive: "${posRecs.loyaltyIncentive}"`);
  console.log(`- Generated ${posRecs.recommendations.length} complementary items:`);
  posRecs.recommendations.forEach((r) => {
    console.log(`  • ${r.name} (₹${r.price}) [${r.tag}]: ${r.reason}`);
  });

  // 3. Generative Marketing Campaign
  console.log('\n📢 Step 3: Generative Marketing Campaign Studio...');
  const campaign = await generateMarketingCampaign({
    campaignGoal: 'Midweek Mega Combo Saver',
    targetAudience: 'Loyalty Club & Repeat Guests',
    discountOffer: 'Flat 20% Off on All Combos (Code: COMBO20)',
    featuredItems: ['The H. G. Special Burger', 'Classic Cold Coffee'],
  });
  console.log(`- Headline: ${campaign.headline}`);
  console.log(`- SMS: ${campaign.smsMessage}`);
  console.log(`- Best Broadcast Window: ${campaign.bestTimeToBroadcast}`);

  // 4. Menu Item Sensory Description Enhancer
  console.log('\n✨ Step 4: Menu Item Sensory Enhancer...');
  const enhanced = await enhanceMenuDescription({
    productName: 'The H. G. Special Burger',
    categoryName: 'Signature Burgers',
    price: 220,
  });
  console.log(`- Tagline: "${enhanced.shortTagline}"`);
  console.log(`- Description: ${enhanced.culinaryDescription}`);
  console.log(`- Taste Notes: ${enhanced.tasteNotes.join(', ')}`);

  // 5. Interactive Copilot
  console.log('\n🤖 Step 5: Interactive Gemini Business Advisor Copilot...');
  const answer = await askGeminiAdvisor(
    'How should Hourglass Cafe price our afternoon beverage combo to clear dead stock and maximize gross profit?',
    { summary: baseReport.summary }
  );
  console.log(`- Advisor Consultation Response snippet:\n${answer.slice(0, 300)}...\n`);

  console.log('🎉 ALL GEMINI AI POS & BUSINESS GROWTH MODULES OPERATIONAL AND VERIFIED!');
}

main().catch((err) => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});
