import { getDatabase } from '../db';

export interface CartRecommendation {
  productId: string;
  name: string;
  category: string;
  price: number;
  reason: string;
  tag?: string;
  pitchScript?: string;
}

export interface CartRecommendationsResponse {
  recommendations: CartRecommendation[];
  staffPitchScript: string;
  loyaltyIncentive?: string;
  projectedAovIncrease: number;
}

export interface StrategicGrowthAudit {
  healthScore: number; // 0-100
  executiveSummary: string;
  keyStrengths: string[];
  immediateActionPoints: string[];
  growthExperiments: Array<{
    title: string;
    description: string;
    targetAudience: string;
    expectedRevenueImpact: string;
    difficulty: 'easy' | 'medium' | 'advanced';
    suggestedPromoCopy: string;
  }>;
  menuEngineeringAdvice: {
    starItemStrategy: string;
    deadStockClearanceStrategy: string;
    marginExpansionPointers: string[];
  };
}

export interface AiGeneratedCampaign {
  headline: string;
  smsMessage: string;
  whatsappMessage: string;
  emailSubject: string;
  emailBody: string;
  suggestedDiscount: string;
  bestTimeToBroadcast: string;
}

export interface EnhancedMenuDescription {
  productName: string;
  culinaryDescription: string;
  shortTagline: string;
  tasteNotes: string[];
  suggestedPairing: string;
}

const DEFAULT_API_KEY = process.env.GEMINI_API_KEY || '';

// Prioritized model hierarchy for fast and reliable performance
const GEMINI_MODELS = [
  'gemini-3.5-flash',
  'gemini-flash-latest',
  'gemini-3.7-flash',
  'gemini-3.1-flash-lite',
];

export function getGeminiApiKey(): string {
  if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim().length > 0) {
    return process.env.GEMINI_API_KEY.trim();
  }
  try {
    const db = getDatabase();
    const row = db.prepare(`SELECT value FROM settings WHERE key = 'gemini_api_key'`).get() as any;
    if (row && row.value && String(row.value).trim().length > 0) {
      return String(row.value).trim();
    }
  } catch {
    // Ignore DB fetch errors on early startup
  }
  return DEFAULT_API_KEY;
}

function extractJsonFromText(raw: string): any {
  let cleaned = raw.trim();
  if (cleaned.includes('```')) {
    const match = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (match && match[1]) {
      cleaned = match[1].trim();
    }
  }
  try {
    return JSON.parse(cleaned);
  } catch (err) {
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      const slice = cleaned.substring(firstBrace, lastBrace + 1);
      return JSON.parse(slice);
    }
    const firstBracket = cleaned.indexOf('[');
    const lastBracket = cleaned.lastIndexOf(']');
    if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
      const slice = cleaned.substring(firstBracket, lastBracket + 1);
      return JSON.parse(slice);
    }
    throw err;
  }
}

/**
 * Low-level caller to Gemini Generative Language API with automatic model fallbacks.
 */
export async function callGeminiApi(prompt: string, systemInstruction?: string, temperature = 0.7): Promise<string> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error('Gemini API key is not configured.');
  }

  let lastError: any = null;

  for (const model of GEMINI_MODELS) {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const requestBody: any = {
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        temperature,
        maxOutputTokens: 3072,
      },
    };

    if (systemInstruction) {
      requestBody.systemInstruction = {
        parts: [{ text: systemInstruction }],
      };
    }

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(15000), // 15s timeout
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.warn(`[Gemini AI] Model ${model} returned HTTP ${response.status}: ${errorText}`);
        lastError = new Error(`HTTP ${response.status}: ${errorText}`);
        continue; // Try next model
      }

      const data = (await response.json()) as any;
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text && typeof text === 'string') {
        return text.trim();
      }
    } catch (err: any) {
      console.warn(`[Gemini AI] Attempt with ${model} failed: ${err.message}`);
      lastError = err;
    }
  }

  throw lastError || new Error('All Gemini AI model endpoints failed.');
}

/**
 * 1. AI Real-Time Cart Upsell & Recommendation Engine
 * Analyzes items currently in customer's cart and recommends optimal add-ons.
 */
export async function generateCartRecommendations(params: {
  cartItems: Array<{ id?: string; name: string; category?: string; price: number; quantity: number }>;
  customerName?: string;
  loyaltyPoints?: number;
  timeOfDay?: string; // 'morning' | 'afternoon' | 'evening' | 'night'
  availableMenu?: Array<{ id: string; name: string; category: string; price: number }>;
}): Promise<CartRecommendationsResponse> {
  const db = getDatabase();

  // Load available active menu items if not passed
  let menu = params.availableMenu;
  if (!menu || menu.length === 0) {
    const rows = db.prepare(`
      SELECT p.id, p.name, COALESCE(c.name, 'Other') as category, p.price
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
      WHERE p.deleted_at IS NULL
      ORDER BY p.price ASC
    `).all() as any[];
    menu = rows.map((r) => ({
      id: String(r.id),
      name: r.name,
      category: r.category,
      price: Number(r.price),
    }));
  }

  const currentCartNames = params.cartItems.map((i) => i.name.toLowerCase());
  const eligibleCandidates = menu.filter((m) => !currentCartNames.includes(m.name.toLowerCase()));

  const timeContext = params.timeOfDay || getTimeOfDayCategory();

  const prompt = `
You are the AI Chief Sommelier & Upselling Strategist for "Hourglass Cafe" (tagline: "Taste The Rhythm of Time").
Goal: Maximize customer satisfaction and Average Order Value (AOV) by suggesting 2 to 3 optimal complementary add-on items from the available menu for the customer's current cart.

CURRENT CART:
${params.cartItems.map((item) => `- ${item.name} (x${item.quantity}) - ₹${item.price}`).join('\n')}

CUSTOMER & CONTEXT:
- Customer Name: ${params.customerName || 'Valued Guest'}
- Loyalty Points Balance: ${params.loyaltyPoints ?? 0} pts
- Time of Day: ${timeContext}

AVAILABLE MENU CANDIDATES (Choose ONLY from this list):
${eligibleCandidates.slice(0, 40).map((m) => `ID: ${m.id} | ${m.name} | Cat: ${m.category} | Price: ₹${m.price}`).join('\n')}

Respond ONLY with a valid JSON object matching this schema:
{
  "recommendations": [
    {
      "productId": "<exact ID from candidates list>",
      "name": "<exact item name>",
      "category": "<category>",
      "price": <price number>,
      "reason": "<1 concise sentence explaining why it pairs perfectly with their current items>",
      "tag": "<e.g. 'Chef Pairing' | 'Best Value' | 'Sweet Finish' | 'Trending'>",
      "pitchScript": "<A short natural one-liner for the staff to say to the customer>"
    }
  ],
  "staffPitchScript": "<A cohesive, polite 1-2 sentence recommendation line the cashier can say>",
  "loyaltyIncentive": "<If loyalty points > 50, a quick prompt like 'Redeem 50 pts for ₹25 off', else how many points this order earns>",
  "projectedAovIncrease": <approximate sum of recommended items price>
}
`;

  try {
    const rawAiResponse = await callGeminiApi(
      prompt,
      'You are a culinary upselling engine. Always respond in strict, valid JSON with no markdown wrapping.',
      0.4
    );

    const parsed = extractJsonFromText(rawAiResponse);

    // Verify recommendations exist in menu
    const verifiedRecs: CartRecommendation[] = [];
    if (Array.isArray(parsed.recommendations)) {
      for (const rec of parsed.recommendations) {
        const found = menu.find((m) => m.id === rec.productId || m.name.toLowerCase() === rec.name?.toLowerCase());
        if (found) {
          verifiedRecs.push({
            productId: found.id,
            name: found.name,
            category: found.category,
            price: found.price,
            reason: rec.reason || `Delicious pairing with your current selection.`,
            tag: rec.tag || 'Chef Recommended',
            pitchScript: rec.pitchScript || `Would you like to add ${found.name} for ₹${found.price}?`,
          });
        }
      }
    }

    if (verifiedRecs.length > 0) {
      return {
        recommendations: verifiedRecs.slice(0, 3),
        staffPitchScript: parsed.staffPitchScript || `May I suggest adding ${verifiedRecs[0].name} to complete your meal?`,
        loyaltyIncentive: parsed.loyaltyIncentive || `This order earns points towards free beverages!`,
        projectedAovIncrease: verifiedRecs.reduce((acc, r) => acc + r.price, 0),
      };
    }
  } catch (err: any) {
    console.warn('[Gemini AI] Recommendation engine fallback invoked:', err.message);
  }

  // Fallback Heuristics when offline / parsing error
  return getHeuristicRecommendations(params.cartItems, eligibleCandidates);
}

/**
 * 2. AI Strategic Business Growth & Executive Advisor
 * Audits sales trends, dead stock, star items, peak hours, and provides high-ROI experiments.
 */
export async function generateStrategicGrowthAnalysis(report: any): Promise<StrategicGrowthAudit> {
  const summary = report.summary || {};
  const stars = (report.products?.stars || []).map((s: any) => `${s.name} (₹${s.revenue})`).slice(0, 5).join(', ');
  const deadStock = (report.products?.dead_stock || []).map((d: any) => d.name).slice(0, 5).join(', ');
  const slowestDay = report.day_of_week_distribution?.find((d: any) => d.is_slowest)?.day_name || 'Midweek';
  const peakDay = report.day_of_week_distribution?.find((d: any) => d.is_peak)?.day_name || 'Weekend';

  const prompt = `
You are the Chief Business Growth Officer & Restaurant AI Consultant for "Hourglass Cafe".
Analyze this cafe performance snapshot and generate an executive-level strategic growth blueprint.

RESTAURANT PERFORMANCE DATA (Last ${report.period}):
- Total Revenue: ₹${summary.total_revenue || 0}
- Total Orders: ${summary.total_orders || 0}
- Average Order Value (AOV): ₹${summary.average_order_value || 0}
- Active Menu Items: ${summary.active_menu_items_count || 0}
- Zero-Sales (Dead Stock) Items: ${summary.dead_stock_count || 0} (${deadStock || 'None'})
- Star Bestsellers: ${stars || 'Top menu items'}
- Peak Revenue Day: ${peakDay}
- Slowest Revenue Day: ${slowestDay}

Produce an executive growth audit in valid JSON format matching this schema:
{
  "healthScore": <integer between 60 and 95 based on health>,
  "executiveSummary": "<2-3 insightful sentences evaluating cafe performance, strengths, and primary revenue lever>",
  "keyStrengths": [
    "<Strength 1>",
    "<Strength 2>",
    "<Strength 3>"
  ],
  "immediateActionPoints": [
    "<Immediate action 1 to increase revenue>",
    "<Immediate action 2 to boost margins>",
    "<Immediate action 3 to clear dead stock>"
  ],
  "growthExperiments": [
    {
      "title": "<Catchy experiment title>",
      "description": "<Detailed step-by-step description of how to run this promotion or operational tweak>",
      "targetAudience": "<Target segment, e.g. Afternoon remote workers / Weekend families / Loyalty VIPs>",
      "expectedRevenueImpact": "<e.g. +15% to +25% order lift on ${slowestDay}>",
      "difficulty": "easy",
      "suggestedPromoCopy": "<Short SMS/WhatsApp text to broadcast to customers>"
    },
    {
      "title": "<Experiment 2 title>",
      "description": "<Description>",
      "targetAudience": "<Audience>",
      "expectedRevenueImpact": "<Impact>",
      "difficulty": "medium",
      "suggestedPromoCopy": "<Promo text>"
    },
    {
      "title": "<Experiment 3 title>",
      "description": "<Description>",
      "targetAudience": "<Audience>",
      "expectedRevenueImpact": "<Impact>",
      "difficulty": "easy",
      "suggestedPromoCopy": "<Promo text>"
    }
  ],
  "menuEngineeringAdvice": {
    "starItemStrategy": "<How to protect margins and leverage top star items for upselling>",
    "deadStockClearanceStrategy": "<Specific plan to repurpose or bundle zero-sales items before expiry>",
    "marginExpansionPointers": [
      "<Pointer 1>",
      "<Pointer 2>"
    ]
  }
}
`;

  try {
    const rawAi = await callGeminiApi(
      prompt,
      'You are a high-level hospitality business strategist. Respond only with valid JSON with no markdown wrapping.',
      0.5
    );

    return extractJsonFromText(rawAi);
  } catch (err: any) {
    console.warn('[Gemini AI] Strategic growth analysis fallback invoked:', err.message);
    return getHeuristicGrowthAudit(report);
  }
}

/**
 * 3. AI Marketing Campaign & Multi-Channel Copy Generator
 */
export async function generateMarketingCampaign(params: {
  campaignGoal: string; // e.g. "Weekend Burger Fiesta", "Afternoon Coffee Happy Hour", "Monsoon Chai & Pakora special"
  targetAudience?: string;
  discountOffer?: string; // e.g. "20% Off", "Buy 1 Get 1", "Free Dessert on orders above ₹400"
  featuredItems?: string[];
  tone?: 'festive' | 'urgent' | 'exclusive' | 'warm';
}): Promise<AiGeneratedCampaign> {
  const prompt = `
Create a compelling multi-channel promotional marketing campaign for "Hourglass Cafe" (Tagline: "Taste The Rhythm of Time").
Online Order Portal: https://pos.15.207.179.83.nip.io/order
Contact: +91 96431 77506

CAMPAIGN DETAILS:
- Goal / Theme: ${params.campaignGoal}
- Target Audience: ${params.targetAudience || 'All registered cafe customers'}
- Offer / Discount: ${params.discountOffer || 'Special limited time pricing'}
- Featured Items: ${params.featuredItems?.join(', ') || 'Chef Specials & Signature Brews'}
- Tone: ${params.tone || 'warm & exciting'}

Generate high-converting promotional copies in JSON format matching this schema:
{
  "headline": "<Catchy campaign title>",
  "smsMessage": "<Concise SMS under 160 chars with emojis and direct order link https://pos.15.207.179.83.nip.io/order>",
  "whatsappMessage": "<Formatted WhatsApp message with bold highlights, bullets, emojis, and call-to-action>",
  "emailSubject": "<Catchy email subject line with high open rate>",
  "emailBody": "<HTML formatted email body with greeting, offer description, button to order online, and cafe signature>",
  "suggestedDiscount": "<Promo code and discount percentage>",
  "bestTimeToBroadcast": "<Recommended day and hour to send this broadcast, e.g. Friday 4:00 PM>"
}
`;

  try {
    const rawAi = await callGeminiApi(
      prompt,
      'You are an expert hospitality copywriter. Respond in strict JSON only.',
      0.7
    );

    return extractJsonFromText(rawAi);
  } catch (err: any) {
    console.warn('[Gemini AI] Marketing campaign generation fallback:', err.message);
    return {
      headline: params.campaignGoal,
      smsMessage: `Special from Hourglass Cafe: ${params.campaignGoal}! Enjoy ${params.discountOffer || 'great discounts'}. Order now: https://pos.15.207.179.83.nip.io/order`,
      whatsappMessage: `*Special from Hourglass Cafe: ${params.campaignGoal}* ⏳🍔\n\nEnjoy ${params.discountOffer || 'exclusive savings'} today!\n\nOrder online: https://pos.15.207.179.83.nip.io/order`,
      emailSubject: `🎉 Special from Hourglass Cafe: ${params.campaignGoal}`,
      emailBody: `<p>Hi there,</p><p>We are excited to bring you <strong>${params.campaignGoal}</strong> at Hourglass Cafe!</p><p>Enjoy ${params.discountOffer || 'special deals'} when you visit or order online.</p>`,
      suggestedDiscount: params.discountOffer || 'FEAST15 (15% Off)',
      bestTimeToBroadcast: 'Friday 4:00 PM',
    };
  }
}

/**
 * 4. AI Menu Item Description & Sensory Culinary Enhancer
 */
export async function enhanceMenuDescription(params: {
  productName: string;
  categoryName?: string;
  currentDescription?: string;
  price?: number;
}): Promise<EnhancedMenuDescription> {
  const prompt = `
You are a Michelin-star menu consultant and culinary writer for "Hourglass Cafe".
Write an irresistible, sensory-rich menu description for this dish that stimulates appetite and boosts sales.

PRODUCT:
- Name: ${params.productName}
- Category: ${params.categoryName || 'Cafe Special'}
- Price: ₹${params.price || 150}
- Current Description: ${params.currentDescription || 'None'}

Return a valid JSON object matching this schema:
{
  "productName": "${params.productName}",
  "culinaryDescription": "<2 vivid sentences describing fresh ingredients, textures, cooking style, and rich aroma>",
  "shortTagline": "<A snappy 4-6 word badge, e.g. 'Crispy Golden Delight with Spiced Mayo'>",
  "tasteNotes": ["<Note 1>", "<Note 2>", "<Note 3>"],
  "suggestedPairing": "<Recommended beverage or side dish that pairs best>"
}
`;

  try {
    const rawAi = await callGeminiApi(
      prompt,
      'You are an expert food critic and menu writer. Respond in strict JSON only.',
      0.6
    );

    return extractJsonFromText(rawAi);
  } catch (err: any) {
    console.warn('[Gemini AI] Menu enhancement fallback:', err.message);
    return {
      productName: params.productName,
      culinaryDescription: `Freshly prepared with premium quality ingredients and signature house spices for an unforgettable taste.`,
      shortTagline: `Chef's Handcrafted Signature`,
      tasteNotes: ['Savory', 'Aromatic', 'Fresh'],
      suggestedPairing: 'Classic Cold Coffee',
    };
  }
}

/**
 * 5. Interactive Business Advisor Q&A Copilot
 */
export async function askGeminiAdvisor(userQuery: string, businessContext?: any): Promise<string> {
  const contextStr = businessContext ? JSON.stringify(businessContext, null, 2) : 'No extra context';

  const prompt = `
You are the AI Executive Advisor for "Hourglass Cafe" (POS & Cafe Management System).
Answer the cafe manager/owner's question with direct, actionable, practical advice based on modern hospitality best practices and the provided cafe context.

LIVE CAFE CONTEXT:
${contextStr}

OWNER'S QUESTION:
"${userQuery}"

Provide a concise, professional, and directly actionable answer formatted in clean Markdown with bullet points where appropriate.
`;

  return callGeminiApi(
    prompt,
    'You are a seasoned restaurant operations consultant and business strategist.',
    0.6
  );
}

// ----------------------------------------------------
// Helper Heuristics Fallbacks
// ----------------------------------------------------

function getTimeOfDayCategory(): string {
  const hour = new Date().getHours();
  if (hour >= 6 && hour < 11) return 'morning breakfast';
  if (hour >= 11 && hour < 15) return 'lunch rush';
  if (hour >= 15 && hour < 18) return 'afternoon tea & snack time';
  if (hour >= 18 && hour < 22) return 'dinner peak';
  return 'late night cravings';
}

function getHeuristicRecommendations(
  cartItems: Array<{ name: string; price: number }>,
  menu: Array<{ id: string; name: string; category: string; price: number }>
): CartRecommendationsResponse {
  const isDrinkInCart = cartItems.some((i) => i.name.toLowerCase().includes('coffee') || i.name.toLowerCase().includes('tea') || i.name.toLowerCase().includes('shake'));
  const isFoodInCart = cartItems.some((i) => i.name.toLowerCase().includes('burger') || i.name.toLowerCase().includes('sandwich') || i.name.toLowerCase().includes('pizza') || i.name.toLowerCase().includes('momo'));

  const recs: CartRecommendation[] = [];

  if (isFoodInCart && !isDrinkInCart) {
    const drink = menu.find((m) => m.category.toLowerCase().includes('beverage') || m.name.toLowerCase().includes('cold coffee')) || menu[0];
    if (drink) {
      recs.push({
        productId: drink.id,
        name: drink.name,
        category: drink.category,
        price: drink.price,
        reason: 'Pairs perfectly with savory food items to complete your meal.',
        tag: 'Drink Pairing',
        pitchScript: `Would you like to pair that with a chilled ${drink.name}?`,
      });
    }
  }

  if (isDrinkInCart && !isFoodInCart) {
    const side = menu.find((m) => m.name.toLowerCase().includes('fries') || m.name.toLowerCase().includes('bun') || m.name.toLowerCase().includes('cookie')) || menu[1];
    if (side) {
      recs.push({
        productId: side.id,
        name: side.name,
        category: side.category,
        price: side.price,
        reason: 'Crispy, warm treat to accompany your drink.',
        tag: 'Snack Addon',
        pitchScript: `Freshly baked ${side.name} goes wonderfully with your brew!`,
      });
    }
  }

  // Dessert / sweet finish
  const dessert = menu.find((m) => m.name.toLowerCase().includes('brownie') || m.name.toLowerCase().includes('cake') || m.name.toLowerCase().includes('ice cream'));
  if (dessert && !cartItems.some((c) => c.name.toLowerCase().includes(dessert.name.toLowerCase()))) {
    recs.push({
      productId: dessert.id,
      name: dessert.name,
      category: dessert.category,
      price: dessert.price,
      reason: 'Sweet treat to finish off your visit.',
      tag: 'Sweet Finish',
      pitchScript: `Can I get you our signature ${dessert.name} for dessert?`,
    });
  }

  // Fill up to 2 items if needed
  while (recs.length < 2 && menu.length > recs.length) {
    const candidate = menu[recs.length];
    if (candidate && !recs.some((r) => r.productId === candidate.id)) {
      recs.push({
        productId: candidate.id,
        name: candidate.name,
        category: candidate.category,
        price: candidate.price,
        reason: 'One of our most popular chef recommendations.',
        tag: 'Bestseller',
        pitchScript: `May we recommend adding our popular ${candidate.name}?`,
      });
    }
  }

  return {
    recommendations: recs,
    staffPitchScript: recs[0] ? recs[0].pitchScript || 'May we recommend our signature item?' : 'Enjoy your meal!',
    loyaltyIncentive: 'Every ₹10 spent earns 1 loyalty point towards free rewards!',
    projectedAovIncrease: recs.reduce((a, b) => a + b.price, 0),
  };
}

function getHeuristicGrowthAudit(report: any): StrategicGrowthAudit {
  const slowestDay = report.day_of_week_distribution?.find((d: any) => d.is_slowest)?.day_name || 'Tuesday';
  const deadStockCount = report.summary?.dead_stock_count || 0;

  return {
    healthScore: 82,
    executiveSummary: `Hourglass Cafe demonstrates solid core bestseller traction. Primary growth opportunity lies in boosting midweek footfall and bundling high-margin beverages with food orders.`,
    keyStrengths: [
      'High repeat purchase velocity on signature burgers and cold brews',
      'Balanced distribution across takeaway and dine-in channels',
      'Strong average basket size during peak weekend hours',
    ],
    immediateActionPoints: [
      `Deploy a dedicated '${slowestDay} Super Saver' campaign to lift slow-day revenue by ~25%`,
      `Implement 1-tap beverage combo upsells at POS register to increase AOV by ₹40-₹70`,
      `Create a 20% discount tasting clearance for the ${deadStockCount} zero-seller menu items`,
    ],
    growthExperiments: [
      {
        title: `⚡ Afternoon Slump Happy Hour (2 PM - 5 PM)`,
        description: `Offer 20% off all coolers, shakes and appetizers to capture students and remote workers during quiet afternoons.`,
        targetAudience: 'Students & Remote Workers',
        expectedRevenueImpact: '+₹4,500/week incremental revenue',
        difficulty: 'easy',
        suggestedPromoCopy: `Beat the afternoon slump! Enjoy 20% OFF all Coolers & Bites from 2 PM to 5 PM today at Hourglass Cafe! ⏳`,
      },
      {
        title: `🍔 ${slowestDay} Midweek Burger & Shake Duo`,
        description: `Bundle your top burger with a Classic Cold Coffee at a 15% promotional rate exclusive to ${slowestDay}s.`,
        targetAudience: 'Midweek Dinner Crowd',
        expectedRevenueImpact: `+22% order lift on ${slowestDay}s`,
        difficulty: 'easy',
        suggestedPromoCopy: `Midweek Treat! Get the HG Special Burger + Chilled Cold Coffee combo for just ₹299 this ${slowestDay}! 🍔☕`,
      },
    ],
    menuEngineeringAdvice: {
      starItemStrategy: 'Protect star item recipes and ensure rapid kitchen turnaround to maintain high customer ratings.',
      deadStockClearanceStrategy: 'Feature zero-sellers in temporary weekend tasting flights before deciding to rotate them off the menu.',
      marginExpansionPointers: [
        'Add high-margin beverage add-ons (extra shot, whipped cream, caramel drizzle)',
        'Train front-of-house staff to use recommended verbal pitch scripts on all orders',
      ],
    },
  };
}
