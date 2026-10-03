import { initDatabase } from '../main/db';
import {
  generateCartRecommendations,
  generateMarketingCampaign,
  enhanceMenuDescription,
  askGeminiAdvisor,
} from '../main/services/gemini-ai';

async function main() {
  console.log('🧪 Testing Gemini AI Integration for Hourglass Cafe...');
  initDatabase();


  // 1. Test Cart Recommendations
  console.log('\n1. Testing Real-time Cart Recommendations:');
  const cartRecs = await generateCartRecommendations({
    cartItems: [
      { name: 'The H. G. Special Burger', price: 220, quantity: 1, category: 'Burgers' },
    ],
    customerName: 'Rahul',
    loyaltyPoints: 75,
  });
  console.log('Pitch Script:', cartRecs.staffPitchScript);
  console.log('Loyalty:', cartRecs.loyaltyIncentive);
  console.log('Recommendations:', JSON.stringify(cartRecs.recommendations, null, 2));

  // 2. Test Marketing Campaign Generation
  console.log('\n2. Testing Marketing Campaign Generator:');
  const campaign = await generateMarketingCampaign({
    campaignGoal: 'Weekend Burger Fiesta with Free Shakes',
    targetAudience: 'Loyalty Club Members',
    discountOffer: 'Buy Any 2 Burgers, Get 1 Cold Coffee Free',
    featuredItems: ['The H. G. Special Burger', 'Peri Peri Fries', 'Classic Cold Coffee'],
  });
  console.log('Headline:', campaign.headline);
  console.log('SMS Message:', campaign.smsMessage);
  console.log('Best Time to Broadcast:', campaign.bestTimeToBroadcast);

  // 3. Test Menu Description Enhancer
  console.log('\n3. Testing Menu Item Enhancer:');
  const enhanced = await enhanceMenuDescription({
    productName: 'Peri Peri Loaded Fries',
    categoryName: 'Appetizers',
    price: 160,
  });
  console.log('Enhanced Description:', enhanced.culinaryDescription);
  console.log('Tagline:', enhanced.shortTagline);
  console.log('Taste Notes:', enhanced.tasteNotes);

  // 4. Test Advisor Q&A
  console.log('\n4. Testing Gemini Advisor Q&A:');
  const answer = await askGeminiAdvisor(
    'What is the single best tactic to increase Average Order Value for a cafe during lunch hours?'
  );
  console.log('Advisor Answer:\n', answer);

  console.log('\n✅ All Gemini AI Tests Completed Successfully!');
}

main().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
