'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuthStore } from '@/store/auth';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { useFormatCurrency } from '@/hooks/useFormatCurrency';
import {
  Sparkles,
  TrendingUp,
  Clock,
  Calendar,
  Zap,
  ShoppingBag,
  DollarSign,
  AlertCircle,
  CheckCircle2,
  PieChart as PieChartIcon,
  BarChart3,
  Layers,
  ArrowUpRight,
  ArrowRight,
  RefreshCw,
  Search,
  Filter,
  Check,
  ChevronRight,
  ShieldAlert,
  Tag,
  Gift,
  HelpCircle,
  Bot,
  Send,
  Copy,
  Radio,
  Flame,
  MessageSquare,
  Mail,
  Smartphone,
  Sliders,
  Target,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';

interface ProductPerformance {
  id: string;
  name: string;
  category_name: string;
  price: number;
  units_sold: number;
  revenue: number;
  order_count: number;
  classification: 'star' | 'plowhorse' | 'puzzle' | 'dog' | 'dead_stock';
  classification_label: string;
  share_of_sales_pct: number;
  ai_recommendation: string;
}

interface CategoryBreakdown {
  category_id: string | null;
  name: string;
  revenue: number;
  units: number;
  order_count: number;
  percentage: number;
  color: string;
}

interface HourlyBucket {
  hour: number;
  hour_label: string;
  order_count: number;
  revenue: number;
  status: 'rush' | 'steady' | 'idle';
}

interface DayOfWeekBucket {
  day_index: number;
  day_name: string;
  order_count: number;
  revenue: number;
  percentage: number;
  is_peak: boolean;
  is_slowest: boolean;
}

interface StrategicRecommendation {
  id: string;
  type: 'happy_hour' | 'sale_day' | 'upsell_bundle' | 'clearance' | 'loyalty_boost';
  title: string;
  subtitle: string;
  urgency: 'high' | 'medium' | 'opportunity';
  description: string;
  projected_impact: string;
  action_label: string;
  action_payload: {
    target_day?: string;
    target_hours?: string;
    discount_pct?: number;
    recommended_items?: string[];
    campaign_name?: string;
  };
}

interface ActivePromotion {
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

interface StrategicGrowthAudit {
  healthScore: number;
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

interface IntelligenceReport {
  period: string;
  startDate: string;
  endDate: string;
  summary: {
    total_revenue: number;
    total_orders: number;
    average_order_value: number;
    total_items_sold: number;
    active_menu_items_count: number;
    items_with_sales_count: number;
    dead_stock_count: number;
  };
  products: {
    stars: ProductPerformance[];
    plowhorses: ProductPerformance[];
    puzzles: ProductPerformance[];
    dogs: ProductPerformance[];
    dead_stock: ProductPerformance[];
    all: ProductPerformance[];
  };
  categories: CategoryBreakdown[];
  hourly_distribution: HourlyBucket[];
  day_of_week_distribution: DayOfWeekBucket[];
  payment_methods: Array<{ method: string; count: number; total: number; percentage: number }>;
  order_types: Array<{ type: string; count: number; total: number; percentage: number }>;
  upsell_pairings: Array<{
    primary_item: string;
    frequently_bought_with: string;
    co_occurrence_count: number;
    suggested_upsell_script: string;
  }>;
  recommendations: StrategicRecommendation[];
}

export default function IntelligencePage() {
  const formatCurrency = useFormatCurrency();
  const [days, setDays] = useState<number>(14);
  const [loading, setLoading] = useState<boolean>(true);
  const [report, setReport] = useState<IntelligenceReport | null>(null);
  const [promotions, setPromotions] = useState<ActivePromotion[]>([]);
  const [applyingActionId, setApplyingActionId] = useState<string | null>(null);
  const [productFilter, setProductFilter] = useState<'all' | 'star' | 'plowhorse' | 'puzzle' | 'dog' | 'dead_stock'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Gemini AI Growth Audit State
  const [geminiAudit, setGeminiAudit] = useState<StrategicGrowthAudit | null>(null);
  const [loadingAudit, setLoadingAudit] = useState<boolean>(false);

  // Gemini Interactive Copilot State
  const [copilotQuestion, setCopilotQuestion] = useState<string>('');
  const [copilotAnswer, setCopilotAnswer] = useState<string | null>(null);
  const [copilotLoading, setCopilotLoading] = useState<boolean>(false);

  // Gemini Campaign Generator State
  const [campaignGoal, setCampaignGoal] = useState<string>('Weekend Burger Fiesta & Free Shakes');
  const [campaignAudience, setCampaignAudience] = useState<string>('Loyalty Club Members & Repeat Guests');
  const [campaignOffer, setCampaignOffer] = useState<string>('20% Off Burgers & Shakes (Code: FEAST20)');
  const [campaignResult, setCampaignResult] = useState<any | null>(null);
  const [campaignLoading, setCampaignLoading] = useState<boolean>(false);
  const [broadcastingSms, setBroadcastingSms] = useState<boolean>(false);

  const fetchIntelligence = async (selectedDays = days) => {
    setLoading(true);
    try {
      const res = await api.get(`/intelligence/overview?days=${selectedDays}`);
      if (res.data?.success && res.data?.report) {
        setReport(res.data.report);
        setPromotions(res.data.activePromotions || []);
      }
    } catch (err: any) {
      console.error('Failed to load AI intelligence data', err);
      toast.error('Failed to load intelligence report');
    } finally {
      setLoading(false);
    }
  };

  const handleRunGeminiAudit = async () => {
    setLoadingAudit(true);
    try {
      const res = await api.post('/intelligence/gemini-growth', { days });
      if (res.data?.success && res.data?.audit) {
        setGeminiAudit(res.data.audit);
        toast.success('✨ Gemini AI Strategic Audit generated!');
      }
    } catch (err: any) {
      console.error('Gemini audit error', err);
      toast.error('Failed to run Gemini AI Audit');
    } finally {
      setLoadingAudit(false);
    }
  };

  const handleAskCopilot = async (customPrompt?: string) => {
    const q = (customPrompt || copilotQuestion).trim();
    if (!q) return;
    setCopilotLoading(true);
    if (customPrompt) setCopilotQuestion(customPrompt);

    try {
      const res = await api.post('/intelligence/ask-gemini', { question: q, days });
      if (res.data?.success) {
        setCopilotAnswer(res.data.answer);
      }
    } catch (err: any) {
      console.error('Ask Gemini error', err);
      toast.error('Failed to get answer from Gemini AI');
    } finally {
      setCopilotLoading(false);
    }
  };

  const handleGenerateCampaign = async () => {
    if (!campaignGoal.trim()) {
      toast.error('Please enter a campaign goal or theme');
      return;
    }
    setCampaignLoading(true);
    try {
      const res = await api.post('/intelligence/generate-campaign', {
        goal: campaignGoal,
        targetAudience: campaignAudience,
        discountOffer: campaignOffer,
      });
      if (res.data?.success && res.data?.campaign) {
        setCampaignResult(res.data.campaign);
        toast.success('✨ Campaign copy generated by Gemini AI!');
      }
    } catch (err: any) {
      console.error('Generate campaign error', err);
      toast.error('Failed to generate campaign copy');
    } finally {
      setCampaignLoading(false);
    }
  };

  const handleBroadcastCampaignSms = async () => {
    if (!campaignResult?.smsMessage) return;
    setBroadcastingSms(true);
    try {
      const res = await api.post('/loyalty/campaigns/broadcast-sms', {
        template: 'event_promo',
        params: {
          eventTitle: campaignResult.headline,
          eventDescription: campaignResult.smsMessage,
        },
      });
      if (res.data?.success) {
        toast.success(`📢 Broadcast sent to ${res.data.totalSent} customers!`);
      }
    } catch (err: any) {
      console.error('Broadcast campaign SMS error', err);
      toast.error('Failed to broadcast campaign SMS');
    } finally {
      setBroadcastingSms(false);
    }
  };

  useEffect(() => {
    fetchIntelligence(days);
  }, [days]);

  const handleApplyAction = async (rec: StrategicRecommendation) => {
    setApplyingActionId(rec.id);
    try {
      const res = await api.post('/intelligence/apply-action', {
        recommendation_id: rec.id,
        action_payload: rec.action_payload,
      });
      if (res.data?.success) {
        toast.success(res.data.message || 'Promotion configured successfully!');
        if (res.data.promotion) {
          setPromotions((prev) => [res.data.promotion, ...prev]);
        }
      }
    } catch (err: any) {
      console.error('Failed to apply recommendation action', err);
      toast.error('Failed to apply recommendation');
    } finally {
      setApplyingActionId(null);
    }
  };

  const filteredProducts = useMemo(() => {
    if (!report?.products?.all) return [];
    return report.products.all.filter((p) => {
      const matchesCategory = productFilter === 'all' || p.classification === productFilter;
      const matchesSearch =
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.category_name.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [report, productFilter, searchQuery]);

  if (loading && !report) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="relative">
          <div className="w-12 h-12 rounded-full border-4 border-amber-500/20 border-t-amber-600 animate-spin" />
          <Sparkles className="w-5 h-5 text-amber-600 absolute inset-0 m-auto animate-pulse" />
        </div>
        <p className="text-sm font-medium text-muted-foreground animate-pulse">
          Analyzing sales trends, basket patterns & Google Gemini AI business intelligence...
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-8 max-w-[1600px] mx-auto">
      {/* Header Section */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 text-amber-600 dark:text-amber-400 ring-1 ring-amber-500/30 shadow-xs">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight">AI Advisor & Business Intelligence</h1>
                <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20 font-medium">
                  Powered by Google Gemini
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">
                Real-time sales neural audit, automatic cart upselling, generative marketing campaigns, and menu engineering.
              </p>
            </div>
          </div>
        </div>

        {/* Period Selector & Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="bg-muted/60 p-1 rounded-lg flex items-center border text-xs font-medium">
            {[
              { label: 'Today', val: 1 },
              { label: '7 Days', val: 7 },
              { label: '14 Days', val: 14 },
              { label: '30 Days', val: 30 },
              { label: '90 Days', val: 90 },
            ].map((p) => (
              <button
                key={p.val}
                onClick={() => setDays(p.val)}
                className={`px-3 py-1.5 rounded-md transition-all ${
                  days === p.val
                    ? 'bg-background text-foreground shadow-xs font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <Button
            variant="default"
            size="sm"
            onClick={handleRunGeminiAudit}
            disabled={loadingAudit}
            className="gap-1.5 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white shadow-sm"
          >
            <Sparkles className={`w-3.5 h-3.5 ${loadingAudit ? 'animate-spin' : ''}`} />
            {loadingAudit ? 'Auditing with Gemini...' : 'Run Gemini AI Audit'}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchIntelligence(days)}
            disabled={loading}
            className="gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Top Level Summary Metrics */}
      {report && (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3.5">
          <Card className="shadow-2xs bg-gradient-to-br from-card to-muted/20">
            <CardContent className="p-4 space-y-1">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-medium uppercase tracking-wider">Gross Sales</span>
                <DollarSign className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="text-2xl font-bold tracking-tight text-foreground">
                {formatCurrency(report.summary.total_revenue)}
              </div>
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <span>In selected {days}d period</span>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-2xs bg-gradient-to-br from-card to-muted/20">
            <CardContent className="p-4 space-y-1">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-medium uppercase tracking-wider">Total Orders</span>
                <ShoppingBag className="w-4 h-4 text-blue-500" />
              </div>
              <div className="text-2xl font-bold tracking-tight text-foreground">
                {report.summary.total_orders}
              </div>
              <div className="text-xs text-muted-foreground">
                Avg {(report.summary.total_orders / days).toFixed(1)} orders/day
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-2xs bg-gradient-to-br from-card to-muted/20">
            <CardContent className="p-4 space-y-1">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-medium uppercase tracking-wider">Avg Order Value</span>
                <TrendingUp className="w-4 h-4 text-amber-500" />
              </div>
              <div className="text-2xl font-bold tracking-tight text-foreground">
                {formatCurrency(report.summary.average_order_value)}
              </div>
              <div className="text-xs text-muted-foreground">
                Per ticket basket size
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-2xs bg-gradient-to-br from-card to-muted/20">
            <CardContent className="p-4 space-y-1">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-medium uppercase tracking-wider">Items Sold</span>
                <Layers className="w-4 h-4 text-purple-500" />
              </div>
              <div className="text-2xl font-bold tracking-tight text-foreground">
                {report.summary.total_items_sold}
              </div>
              <div className="text-xs text-muted-foreground">
                Units prepared in kitchen
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-2xs bg-gradient-to-br from-card to-muted/20">
            <CardContent className="p-4 space-y-1">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-medium uppercase tracking-wider">Star Bestsellers</span>
                <Sparkles className="w-4 h-4 text-amber-500" />
              </div>
              <div className="text-2xl font-bold tracking-tight text-amber-600 dark:text-amber-400">
                {report.products.stars.length}
              </div>
              <div className="text-xs text-muted-foreground">
                High-volume & high-revenue
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-2xs bg-gradient-to-br from-card to-muted/20">
            <CardContent className="p-4 space-y-1">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-medium uppercase tracking-wider">Zero-Sellers</span>
                <AlertCircle className="w-4 h-4 text-rose-500" />
              </div>
              <div className="text-2xl font-bold tracking-tight text-rose-600 dark:text-rose-400">
                {report.summary.dead_stock_count}
              </div>
              <div className="text-xs text-muted-foreground">
                Candidates for clearance
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* GEMINI AI STRATEGIC GROWTH AUDIT (When generated) */}
      {geminiAudit && (
        <Card className="border-amber-500/40 bg-gradient-to-br from-amber-500/10 via-card to-orange-500/5 shadow-md">
          <CardHeader className="p-6 pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-2xl bg-amber-600 text-white flex items-center justify-center font-black text-xl shadow-sm">
                  {geminiAudit.healthScore}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-xl font-bold">Gemini AI Executive Business Audit</CardTitle>
                    <Badge className="bg-emerald-600 text-white">Health Score: {geminiAudit.healthScore}/100</Badge>
                  </div>
                  <CardDescription className="text-xs mt-0.5">
                    Synthesized from your recent {days}-day sales trajectory and customer purchase patterns.
                  </CardDescription>
                </div>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-6 pt-2 space-y-5">
            {/* Executive Summary */}
            <div className="p-3.5 rounded-xl bg-background/90 border border-amber-500/20 text-sm leading-relaxed text-foreground">
              <p className="font-medium">{geminiAudit.executiveSummary}</p>
            </div>

            {/* Strengths & Action Points Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-card border border-border/80 space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-600 flex items-center gap-1.5">
                  <CheckCircle2 size={14} /> Core Revenue Strengths
                </h4>
                <ul className="space-y-1.5 text-xs text-muted-foreground">
                  {geminiAudit.keyStrengths.map((s, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-emerald-500 font-bold">•</span>
                      <span>{s}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="p-4 rounded-xl bg-card border border-border/80 space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-amber-600 flex items-center gap-1.5">
                  <Target size={14} /> Immediate Profit Action Points
                </h4>
                <ul className="space-y-1.5 text-xs text-muted-foreground">
                  {geminiAudit.immediateActionPoints.map((a, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-amber-500 font-bold">•</span>
                      <span>{a}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* 3 High-ROI Growth Experiments */}
            <div className="space-y-3">
              <h4 className="text-sm font-bold flex items-center gap-2">
                <Flame className="w-4 h-4 text-orange-500" />
                Gemini High-ROI Growth Experiments
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                {geminiAudit.growthExperiments.map((exp, idx) => (
                  <div key={idx} className="p-4 rounded-xl border border-border bg-card flex flex-col justify-between space-y-3">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-1">
                        <Badge variant="outline" className="text-[10px] font-bold uppercase bg-amber-500/10 text-amber-700">
                          {exp.difficulty} difficulty
                        </Badge>
                        <span className="text-[11px] font-bold text-emerald-600">{exp.expectedRevenueImpact}</span>
                      </div>
                      <h5 className="font-bold text-sm text-foreground">{exp.title}</h5>
                      <p className="text-xs text-muted-foreground leading-relaxed">{exp.description}</p>
                    </div>

                    <div className="p-2.5 rounded-lg bg-muted/40 border text-[11px] space-y-1">
                      <span className="font-semibold text-muted-foreground block">Target: {exp.targetAudience}</span>
                      <p className="italic text-foreground font-mono text-[10px]">"{exp.suggestedPromoCopy}"</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* TWO COLUMN GRID: AI Copilot & AI Campaign Studio */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 1. Ask Gemini AI Advisor Copilot */}
        <Card className="shadow-2xs flex flex-col justify-between">
          <CardHeader className="p-5 pb-3">
            <div className="flex items-center gap-2">
              <Bot className="w-5 h-5 text-amber-600" />
              <CardTitle className="text-lg font-bold">Ask Gemini AI Growth Advisor</CardTitle>
            </div>
            <CardDescription className="text-xs">
              Directly query Google Gemini on revenue expansion, slow-day boosting, and operational tactics.
            </CardDescription>
          </CardHeader>

          <CardContent className="p-5 pt-0 space-y-4 flex-1 flex flex-col justify-between">
            {/* Quick Suggestion Chips */}
            <div className="flex flex-wrap gap-1.5">
              {[
                'How to increase Tuesday footfall?',
                'Top 3 beverage upselling tactics',
                'How to eliminate zero-sellers?',
                'Plan a weekend combo promotion',
              ].map((chip, idx) => (
                <button
                  key={idx}
                  onClick={() => handleAskCopilot(chip)}
                  className="px-2.5 py-1 rounded-full bg-muted/80 hover:bg-amber-500/10 hover:text-amber-700 text-[11px] font-medium transition border text-muted-foreground"
                >
                  💡 {chip}
                </button>
              ))}
            </div>

            {/* Answer Display */}
            <div className="min-h-[160px] p-3.5 rounded-xl bg-muted/20 border border-border/70 text-xs overflow-y-auto max-h-[300px]">
              {copilotLoading ? (
                <div className="flex items-center gap-2 text-muted-foreground py-8 justify-center">
                  <Sparkles className="w-4 h-4 animate-spin text-amber-600" />
                  <span>Gemini is synthesizing live cafe insights...</span>
                </div>
              ) : copilotAnswer ? (
                <div className="prose prose-xs dark:prose-invert max-w-none whitespace-pre-wrap leading-relaxed">
                  {copilotAnswer}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground py-8">
                  <Bot className="w-8 h-8 text-muted-foreground/40 mb-2" />
                  <p>Type any question or click a prompt above to consult your AI advisor.</p>
                </div>
              )}
            </div>

            {/* Input form */}
            <div className="flex gap-2">
              <Input
                placeholder="Ask e.g. What pricing strategy works best for combos?"
                value={copilotQuestion}
                onChange={(e) => setCopilotQuestion(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAskCopilot();
                }}
                className="text-xs h-9"
              />
              <Button
                size="sm"
                onClick={() => handleAskCopilot()}
                disabled={copilotLoading || !copilotQuestion.trim()}
                className="gap-1.5 bg-amber-600 hover:bg-amber-700 text-white shrink-0"
              >
                <Send size={14} /> Ask
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* 2. AI Multi-Channel Campaign & Copy Studio */}
        <Card className="shadow-2xs flex flex-col justify-between">
          <CardHeader className="p-5 pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Radio className="w-5 h-5 text-amber-600" />
                <CardTitle className="text-lg font-bold">AI Multi-Channel Campaign Studio</CardTitle>
              </div>
              <Badge variant="outline" className="text-[10px] text-amber-700 bg-amber-500/10">
                1-Tap SMS Broadcast
              </Badge>
            </div>
            <CardDescription className="text-xs">
              Generate high-conversion SMS, WhatsApp, and Email copies tailored to your customer base.
            </CardDescription>
          </CardHeader>

          <CardContent className="p-5 pt-0 space-y-3.5 flex-1 flex flex-col justify-between">
            {/* Input Controls */}
            <div className="space-y-2">
              <div>
                <label className="text-[11px] font-semibold text-muted-foreground">Campaign Theme / Goal</label>
                <Input
                  value={campaignGoal}
                  onChange={(e) => setCampaignGoal(e.target.value)}
                  placeholder="e.g. Afternoon Happy Hour or Weekend Burger Fiesta"
                  className="text-xs h-8 mt-0.5"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-semibold text-muted-foreground">Audience</label>
                  <Input
                    value={campaignAudience}
                    onChange={(e) => setCampaignAudience(e.target.value)}
                    placeholder="e.g. Loyalty VIPs"
                    className="text-xs h-8 mt-0.5"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-muted-foreground">Offer / Discount</label>
                  <Input
                    value={campaignOffer}
                    onChange={(e) => setCampaignOffer(e.target.value)}
                    placeholder="e.g. 20% Off"
                    className="text-xs h-8 mt-0.5"
                  />
                </div>
              </div>
            </div>

            <Button
              size="sm"
              onClick={handleGenerateCampaign}
              disabled={campaignLoading}
              className="w-full gap-1.5 bg-amber-600 hover:bg-amber-700 text-white"
            >
              <Sparkles className={`w-3.5 h-3.5 ${campaignLoading ? 'animate-spin' : ''}`} />
              {campaignLoading ? 'Crafting Marketing Copy...' : 'Generate AI Campaign Copy'}
            </Button>

            {/* Campaign Result Previews */}
            {campaignResult && (
              <div className="p-3 rounded-xl bg-background border border-amber-500/30 space-y-2 text-xs">
                <div className="flex items-center justify-between border-b pb-1.5">
                  <span className="font-bold text-foreground truncate">{campaignResult.headline}</span>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    Best Time: {campaignResult.bestTimeToBroadcast}
                  </span>
                </div>

                {/* SMS Text */}
                <div className="p-2 rounded-md bg-muted/40 text-[11px] font-mono leading-relaxed space-y-1">
                  <div className="flex items-center justify-between text-muted-foreground text-[10px]">
                    <span className="flex items-center gap-1 font-bold"><Smartphone size={10} /> SMS Body:</span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(campaignResult.smsMessage);
                        toast.success('SMS copy copied to clipboard');
                      }}
                      className="hover:text-foreground flex items-center gap-1"
                    >
                      <Copy size={10} /> Copy
                    </button>
                  </div>
                  <p>{campaignResult.smsMessage}</p>
                </div>

                <div className="flex gap-2 pt-1">
                  <Button
                    size="sm"
                    onClick={handleBroadcastCampaignSms}
                    disabled={broadcastingSms}
                    className="flex-1 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    <Radio className={`w-3 h-3 ${broadcastingSms ? 'animate-spin' : ''}`} />
                    {broadcastingSms ? 'Broadcasting...' : 'Broadcast to All Customers (SMS)'}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Algorithmic Recommendations & Actionable Levers */}
      {report && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-500 fill-amber-500" />
              <h2 className="text-xl font-bold tracking-tight">AI Strategic Growth Presets & Action Levers</h2>
            </div>
            <span className="text-xs text-muted-foreground font-medium">
              1-Click Instant Execution to POS & Digital Menu
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {report.recommendations.map((rec) => {
              const isUrgent = rec.urgency === 'high';
              const isApplying = applyingActionId === rec.id;

              return (
                <Card
                  key={rec.id}
                  className={`flex flex-col justify-between border transition-all duration-200 hover:shadow-md ${
                    isUrgent
                      ? 'border-amber-500/40 bg-gradient-to-b from-amber-500/5 to-transparent'
                      : 'border-border/80 bg-card/60'
                  }`}
                >
                  <CardHeader className="p-5 pb-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <Badge
                        variant={isUrgent ? 'default' : 'secondary'}
                        className={`text-[10px] font-semibold tracking-wide uppercase ${
                          isUrgent ? 'bg-amber-600 hover:bg-amber-600 text-white' : ''
                        }`}
                      >
                        {rec.urgency === 'high' ? 'High Impact' : rec.urgency === 'opportunity' ? 'Revenue Growth' : 'Inventory Optimization'}
                      </Badge>

                      <div className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                        {rec.projected_impact}
                      </div>
                    </div>

                    <CardTitle className="text-base font-bold leading-snug">
                      {rec.title}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground font-medium">
                      {rec.subtitle}
                    </p>
                  </CardHeader>

                  <CardContent className="p-5 pt-0 space-y-4 flex-1 flex flex-col justify-between">
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {rec.description}
                    </p>

                    {rec.action_payload.recommended_items && (
                      <div className="p-2.5 rounded-lg bg-muted/40 border border-border/60 space-y-1">
                        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">
                          Target Menu Items:
                        </span>
                        <div className="flex flex-wrap gap-1">
                          {rec.action_payload.recommended_items.map((item, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-0.5 rounded-md bg-background border text-[11px] font-medium text-foreground"
                            >
                              {item}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="pt-2 border-t flex items-center justify-between gap-2">
                      <div className="text-[11px] text-muted-foreground">
                        {rec.action_payload.discount_pct ? `${rec.action_payload.discount_pct}% Discount Preset` : 'Configuration Ready'}
                      </div>
                      <Button
                        size="sm"
                        disabled={isApplying}
                        onClick={() => handleApplyAction(rec)}
                        className={`text-xs gap-1.5 transition-all ${
                          isUrgent
                            ? 'bg-amber-600 hover:bg-amber-700 text-white'
                            : 'bg-primary text-primary-foreground'
                        }`}
                      >
                        {isApplying ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Check className="w-3.5 h-3.5" />
                        )}
                        {rec.action_label}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Menu Engineering & Product Classification Matrix */}
      {report && (
        <Card className="shadow-2xs">
          <CardHeader className="p-5 pb-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <Layers className="w-5 h-5 text-primary" />
                  Menu Engineering BCG Matrix (All {report.products.all.length} Items)
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Algorithmic breakdown categorizing products by sales velocity, margin potential, and customer demand.
                </p>
              </div>

              {/* Filter Tabs & Search */}
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search menu item..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-8 pl-8 text-xs w-[180px] sm:w-[220px]"
                  />
                </div>

                <div className="flex items-center bg-muted/60 p-1 rounded-lg border text-xs">
                  {[
                    { id: 'all', label: `All (${report.products.all.length})` },
                    { id: 'star', label: `🌟 Stars (${report.products.stars.length})` },
                    { id: 'plowhorse', label: `🐎 Stable (${report.products.plowhorses.length})` },
                    { id: 'puzzle', label: `🧩 High Margin (${report.products.puzzles.length})` },
                    { id: 'dog', label: `🐢 Low (${report.products.dogs.length})` },
                    { id: 'dead_stock', label: `📦 0 Sales (${report.products.dead_stock.length})` },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setProductFilter(tab.id as any)}
                      className={`px-2.5 py-1 rounded-md transition-all text-xs font-medium ${
                        productFilter === tab.id
                          ? 'bg-background text-foreground shadow-xs font-semibold'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/40 border-y text-muted-foreground font-semibold">
                  <tr>
                    <th className="py-3 px-4">Item & Category</th>
                    <th className="py-3 px-3 text-right">Price</th>
                    <th className="py-3 px-3 text-right">Units Sold</th>
                    <th className="py-3 px-3 text-right">Revenue</th>
                    <th className="py-3 px-4">Share of Sales</th>
                    <th className="py-3 px-3">Classification</th>
                    <th className="py-3 px-4">AI Recommended Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filteredProducts.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-muted-foreground">
                        No products match your search/filter.
                      </td>
                    </tr>
                  ) : (
                    filteredProducts.map((p) => {
                      const badgeClass =
                        p.classification === 'star'
                          ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30'
                          : p.classification === 'plowhorse'
                          ? 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30'
                          : p.classification === 'puzzle'
                          ? 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30'
                          : p.classification === 'dog'
                          ? 'bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/30'
                          : 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30';

                      return (
                        <tr key={p.id} className="hover:bg-muted/20 transition-colors">
                          <td className="py-3 px-4">
                            <div className="font-semibold text-foreground">{p.name}</div>
                            <div className="text-[11px] text-muted-foreground">{p.category_name}</div>
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-medium">
                            {formatCurrency(p.price)}
                          </td>
                          <td className="py-3 px-3 text-right font-bold font-mono">
                            {p.units_sold}
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-bold text-emerald-600">
                            {formatCurrency(p.revenue)}
                          </td>
                          <td className="py-3 px-4 min-w-[120px]">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                                <div
                                  style={{ width: `${Math.min(p.share_of_sales_pct * 5, 100)}%` }}
                                  className="h-full bg-primary rounded-full"
                                />
                              </div>
                              <span className="font-mono text-[11px] text-muted-foreground w-8 text-right">
                                {p.share_of_sales_pct}%
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-3 whitespace-nowrap">
                            <Badge variant="outline" className={`text-[10px] font-semibold ${badgeClass}`}>
                              {p.classification_label}
                            </Badge>
                          </td>
                          <td className="py-3 px-4 text-[11px] text-muted-foreground font-medium max-w-[280px]">
                            {p.ai_recommendation}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
