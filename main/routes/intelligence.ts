import { Router, Request, Response } from 'express';
import { generateIntelligenceReport } from '../services/ai-advisor';
import {
  generateCartRecommendations,
  generateStrategicGrowthAnalysis,
  generateMarketingCampaign,
  enhanceMenuDescription,
  askGeminiAdvisor,
} from '../services/gemini-ai';
import { requirePermission } from '../services/authorization';
import { asyncHandler } from '../middleware/async-handler';
import { getDatabase, now } from '../db';
import { randomUUID } from 'crypto';

const router = Router();

// Store active promotional presets configured via AI one-click actions:
export interface ActivePromotion {
  id: string;
  name: string;
  type: string;
  discount_pct: number;
  target_hours?: string;
  target_day?: string;
  recommended_items?: string[];
  created_at: string;
  is_active: boolean;
}

export const activePromotions: ActivePromotion[] = [
  {
    id: 'promo-happy-hour-1',
    name: 'Afternoon Happy Hour (20% Off)',
    type: 'happy_hour',
    discount_pct: 20,
    target_hours: '14:00 - 17:00',
    recommended_items: ['Classic Cold Coffee', 'Lemon Ice Tea', 'Peri Peri Fries'],
    created_at: new Date().toISOString(),
    is_active: true,
  },
];

/**
 * 1. GET /api/intelligence/overview
 * Comprehensive Business Intelligence Report & Base AI Recommendations
 */
router.get(
  '/overview',
  requirePermission('reports.view'),
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const days = parseInt(req.query.days as string, 10) || 14;
      const report = generateIntelligenceReport(days);
      res.json({
        success: true,
        report,
        activePromotions,
      });
    } catch (error: any) {
      console.error('[Intelligence overview error]', error);
      res.status(500).json({ error: 'Failed to generate intelligence report' });
    }
  })
);

/**
 * 2. POST /api/intelligence/gemini-growth
 * On-demand Deep Strategic Growth Audit powered by Google Gemini AI
 */
router.post(
  '/gemini-growth',
  requirePermission('reports.view'),
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const days = parseInt(req.body.days as string, 10) || 14;
      const report = generateIntelligenceReport(days);
      const geminiAudit = await generateStrategicGrowthAnalysis(report);
      res.json({
        success: true,
        audit: geminiAudit,
      });
    } catch (error: any) {
      console.error('[Gemini growth error]', error);
      res.status(500).json({ error: 'Failed to generate Gemini growth analysis' });
    }
  })
);

/**
 * 3. POST /api/intelligence/cart-recommendations
 * Real-time AI Upselling & Complementary Item Pairings for POS Register / Cart
 */
router.post(
  '/cart-recommendations',
  requirePermission('orders.create'),
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const { cartItems, customerName, loyaltyPoints, timeOfDay } = req.body;
      if (!Array.isArray(cartItems) || cartItems.length === 0) {
        return res.json({
          recommendations: [],
          staffPitchScript: 'Enjoy your meal at Hourglass Cafe!',
          projectedAovIncrease: 0,
        });
      }

      const recommendations = await generateCartRecommendations({
        cartItems,
        customerName,
        loyaltyPoints: typeof loyaltyPoints === 'number' ? loyaltyPoints : undefined,
        timeOfDay,
      });

      res.json(recommendations);
    } catch (error: any) {
      console.error('[Cart recommendations error]', error);
      res.status(500).json({ error: 'Failed to generate cart recommendations' });
    }
  })
);

/**
 * 4. POST /api/intelligence/ask-gemini
 * Interactive AI Business Advisor Q&A Copilot for Cafe Owner / Staff
 */
router.post(
  '/ask-gemini',
  requirePermission('reports.view'),
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const { question, days } = req.body;
      if (!question || typeof question !== 'string' || question.trim().length === 0) {
        return res.status(400).json({ error: 'Question is required' });
      }

      const report = generateIntelligenceReport(days || 14);
      const answer = await askGeminiAdvisor(question.trim(), {
        summary: report.summary,
        topStars: report.products.stars.slice(0, 5),
        deadStock: report.products.dead_stock.slice(0, 5),
        slowestDay: report.day_of_week_distribution.find((d) => d.is_slowest),
        peakDay: report.day_of_week_distribution.find((d) => d.is_peak),
      });

      res.json({
        success: true,
        answer,
      });
    } catch (error: any) {
      console.error('[Ask Gemini advisor error]', error);
      res.status(500).json({ error: 'Failed to consult Gemini AI Advisor' });
    }
  })
);

/**
 * 5. POST /api/intelligence/generate-campaign
 * Generate high-converting multi-channel SMS / WhatsApp / Email marketing campaigns
 */
router.post(
  '/generate-campaign',
  requirePermission('reports.view'),
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const { goal, targetAudience, discountOffer, featuredItems, tone } = req.body;
      if (!goal) {
        return res.status(400).json({ error: 'Campaign goal or theme is required' });
      }

      const campaign = await generateMarketingCampaign({
        campaignGoal: goal,
        targetAudience,
        discountOffer,
        featuredItems,
        tone,
      });

      res.json({
        success: true,
        campaign,
      });
    } catch (error: any) {
      console.error('[Generate campaign error]', error);
      res.status(500).json({ error: 'Failed to generate marketing campaign' });
    }
  })
);

/**
 * 6. POST /api/intelligence/enhance-product
 * AI Culinary Description & Sensory Notes Enhancer for Menu Management
 */
router.post(
  '/enhance-product',
  requirePermission('catalog.manage'),
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const { productName, categoryName, currentDescription, price } = req.body;
      if (!productName) {
        return res.status(400).json({ error: 'Product name is required' });
      }

      const enhanced = await enhanceMenuDescription({
        productName,
        categoryName,
        currentDescription,
        price,
      });

      res.json({
        success: true,
        enhanced,
      });
    } catch (error: any) {
      console.error('[Enhance product error]', error);
      res.status(500).json({ error: 'Failed to enhance product description' });
    }
  })
);

/**
 * 7. GET /api/intelligence/recommendations
 * Actionable AI Strategic Recommendations for Owner
 */
router.get(
  '/recommendations',
  requirePermission('reports.view'),
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const days = parseInt(req.query.days as string, 10) || 14;
      const report = generateIntelligenceReport(days);
      res.json({
        recommendations: report.recommendations,
        upsells: report.upsell_pairings,
        slowest_day: report.day_of_week_distribution.find((d) => d.is_slowest),
        peak_day: report.day_of_week_distribution.find((d) => d.is_peak),
      });
    } catch (error: any) {
      console.error('[Intelligence recommendations error]', error);
      res.status(500).json({ error: 'Failed to fetch recommendations' });
    }
  })
);

/**
 * 8. GET /api/intelligence/products-matrix
 * Complete Menu Engineering & Product Classification Matrix
 */
router.get(
  '/products-matrix',
  requirePermission('reports.view'),
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const days = parseInt(req.query.days as string, 10) || 14;
      const report = generateIntelligenceReport(days);
      res.json({
        stars: report.products.stars,
        plowhorses: report.products.plowhorses,
        puzzles: report.products.puzzles,
        dogs: report.products.dogs,
        dead_stock: report.products.dead_stock,
        all: report.products.all,
        summary: report.summary,
      });
    } catch (error: any) {
      console.error('[Intelligence products matrix error]', error);
      res.status(500).json({ error: 'Failed to fetch products matrix' });
    }
  })
);

/**
 * 9. POST /api/intelligence/apply-action
 * One-click execution of an AI Recommendation (e.g. Create Happy Hour, Sale Day, Combo)
 */
router.post(
  '/apply-action',
  requirePermission('reports.view'),
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const { recommendation_id, action_payload } = req.body;
      const newPromo: ActivePromotion = {
        id: `promo-${randomUUID().slice(0, 8)}`,
        name: action_payload?.campaign_name || 'AI Promotional Campaign',
        type: recommendation_id?.replace('rec-', '') || 'custom',
        discount_pct: action_payload?.discount_pct || 15,
        target_hours: action_payload?.target_hours,
        target_day: action_payload?.target_day,
        recommended_items: action_payload?.recommended_items,
        created_at: new Date().toISOString(),
        is_active: true,
      };

      activePromotions.unshift(newPromo);

      res.json({
        success: true,
        message: `✅ AI Action Applied: "${newPromo.name}" has been configured for the POS and Online Menu!`,
        promotion: newPromo,
      });
    } catch (error: any) {
      console.error('[Apply AI action error]', error);
      res.status(500).json({ error: 'Failed to apply recommendation action' });
    }
  })
);

export const intelligenceRoutes = router;
