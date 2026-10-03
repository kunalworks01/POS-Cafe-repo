'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, Plus, Check, MessageSquare, ChevronDown, ChevronUp, Zap } from 'lucide-react';
import api from '@/lib/api';
import { useCartStore } from '@/store/cart';
import type { Product, CartItem } from '@/lib/types';
import { useFormatCurrency } from '@/hooks/useFormatCurrency';

interface AiUpsellBarProps {
  products: Product[];
}

interface Recommendation {
  productId: string;
  name: string;
  category: string;
  price: number;
  reason: string;
  tag?: string;
  pitchScript?: string;
}

interface RecsResponse {
  recommendations: Recommendation[];
  staffPitchScript: string;
  loyaltyIncentive?: string;
  projectedAovIncrease: number;
}

export default function AiUpsellBar({ products }: AiUpsellBarProps) {
  const cart = useCartStore();
  const formatCurrency = useFormatCurrency();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<RecsResponse | null>(null);
  const [expanded, setExpanded] = useState(true);
  const [addedItemIds, setAddedItemIds] = useState<Record<string, boolean>>({});
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const cartFingerprint = cart.items.map((i) => `${i.product.id}:${i.quantity}`).join(',');

  useEffect(() => {
    if (cart.items.length === 0) {
      setData(null);
      return;
    }

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const payload = {
          cartItems: cart.items.map((i) => ({
            id: i.product.id,
            name: i.product.name,
            category: i.product.category_id,
            price: Number(i.product.price),
            quantity: i.quantity,
          })),
          customerName: cart.customer?.name,
          loyaltyPoints: (cart.customer as any)?.loyalty_points,
        };

        const res = await api.post('/intelligence/cart-recommendations', payload);
        if (res.data && Array.isArray(res.data.recommendations)) {
          setData(res.data);
        }
      } catch (err) {
        console.warn('AI cart recommendations error:', err);
      } finally {
        setLoading(false);
      }
    }, 450);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [cartFingerprint, cart.customer]);

  if (cart.items.length === 0 || (!loading && (!data || data.recommendations.length === 0))) {
    return null;
  }

  const handleAddRecommendation = (rec: Recommendation) => {
    // Find matching product in catalog
    const product = products.find(
      (p) => p.id === rec.productId || p.name.toLowerCase() === rec.name.toLowerCase()
    );

    if (product) {
      cart.addItem(product, 1);
      setAddedItemIds((prev) => ({ ...prev, [rec.productId]: true }));
      setTimeout(() => {
        setAddedItemIds((prev) => ({ ...prev, [rec.productId]: false }));
      }, 1500);
    }
  };

  return (
    <div className="mx-3 my-2 rounded-xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-amber-500/5 p-3 text-xs shadow-xs transition-all">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 font-semibold text-amber-900 dark:text-amber-200">
          <Sparkles className={`h-3.5 w-3.5 text-amber-600 dark:text-amber-400 ${loading ? 'animate-spin' : 'animate-pulse'}`} />
          <span>Gemini Smart Upsell</span>
          {loading && <span className="text-[10px] text-muted-foreground">(Analyzing...)</span>}
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-muted-foreground hover:text-foreground transition-colors p-0.5"
          title={expanded ? 'Collapse' : 'Expand'}
        >
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>

      {expanded && (
        <div className="mt-2 space-y-2">
          {/* Staff Pitch Helper */}
          {data?.staffPitchScript && (
            <div className="rounded-md bg-background/80 p-2 text-[11px] leading-snug text-muted-foreground border border-amber-500/20">
              <span className="font-semibold text-amber-700 dark:text-amber-300">Staff Pitch: </span>
              "{data.staffPitchScript}"
            </div>
          )}

          {/* Recommendation Item Cards */}
          <div className="grid grid-cols-1 gap-1.5">
            {data?.recommendations?.map((rec) => {
              const isAdded = addedItemIds[rec.productId];
              return (
                <div
                  key={rec.productId}
                  className="flex items-center justify-between rounded-lg bg-card/90 px-2.5 py-1.5 border border-border/70 shadow-2xs"
                >
                  <div className="min-w-0 flex-1 pr-2">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium text-foreground truncate">{rec.name}</span>
                      {rec.tag && (
                        <span className="shrink-0 rounded-full bg-amber-500/20 px-1.5 py-0.2 text-[9px] font-semibold text-amber-800 dark:text-amber-300">
                          {rec.tag}
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground truncate">{rec.reason}</p>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="font-bold text-foreground">{formatCurrency(rec.price)}</span>
                    <button
                      onClick={() => handleAddRecommendation(rec)}
                      disabled={isAdded}
                      className={`flex h-6 items-center gap-1 rounded-md px-2 text-[10px] font-semibold transition-all ${
                        isAdded
                          ? 'bg-emerald-500 text-white'
                          : 'bg-amber-600 text-white hover:bg-amber-700 active:scale-95'
                      }`}
                    >
                      {isAdded ? (
                        <>
                          <Check size={11} /> Added
                        </>
                      ) : (
                        <>
                          <Plus size={11} /> Add
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Loyalty Incentive */}
          {data?.loyaltyIncentive && (
            <div className="flex items-center gap-1 text-[10px] text-amber-700 dark:text-amber-400 font-medium">
              <Zap size={10} className="text-amber-500 fill-amber-500" />
              <span>{data.loyaltyIncentive}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
