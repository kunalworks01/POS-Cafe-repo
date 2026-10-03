'use client';

import { useState, useRef, useEffect } from 'react';
import api from '@/lib/api';
import { useCartStore } from '@/store/cart';
import { useAuthStore } from '@/store/auth';
import { usePosSettingsStore } from '@/store/pos-settings';
import { X, Pencil, Gift, CheckCircle2, Send, Smartphone, Sparkles, User, Mail, Phone as PhoneIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import { dialCodeFor } from '@/lib/phone';
import type { Customer } from '@/lib/types';
import EditCustomerModal from './EditCustomerModal';
import { Ltr } from '@/components/layout/Ltr';
import { useTranslations } from 'use-intl';

interface Props {
  onSelected?: () => void;
  variant?: 'default' | 'topbar';
}

const TAG_COLORS: Record<string, string> = {
  veg:    'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300',
  nonveg: 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300',
  vegan:  'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
  spicy:  'bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300',
};

function tagColor(tag: string) {
  return TAG_COLORS[tag.toLowerCase()] ?? 'bg-muted text-muted-foreground';
}

function digitsOnly(value: string | null | undefined): string {
  return String(value || '').replace(/\D/g, '');
}

function TagBadges({ counts }: { counts: Record<string, number> }) {
  const t = useTranslations('pos');
  const entries = Object.entries(counts).filter(([, n]) => n > 0);
  if (entries.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {entries.map(([tag, count]) => (
        <span key={tag} className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${tagColor(tag)}`}>
          {t('tagCount', { tag, count })}
        </span>
      ))}
    </div>
  );
}

export default function CustomerSearch({ onSelected, variant = 'default' }: Props = {}) {
  const cart = useCartStore();
  const { currentTenant } = useAuthStore();
  const t = useTranslations('pos');
  const country = currentTenant?.country ?? '';
  const dialCode = dialCodeFor(country);
  const [phone, setPhone] = useState('');
  const [matched, setMatched] = useState<Customer | null>(null);
  const [matchedStats, setMatchedStats] = useState<{ visits: number; totalSpent: number; email?: string } | null>(null);
  const [searched, setSearched] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(false);
  const [loyaltyPoints, setLoyaltyPoints] = useState<number | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const requestAbortRef = useRef<AbortController | null>(null);

  const customer = cart.customer;

  // Reset stale points synchronously during render when customer changes
  const [syncedCustomerId, setSyncedCustomerId] = useState(customer?.id ?? null);
  if ((customer?.id ?? null) !== syncedCustomerId) {
    setSyncedCustomerId(customer?.id ?? null);
    setLoyaltyPoints(null);
  }

  useEffect(() => {
    if (!customer) return;
    const controller = new AbortController();
    api.get(`/customers/${customer.id}/wallet`, { signal: controller.signal })
      .then((res) => setLoyaltyPoints(res.data.balance))
      .catch((err: unknown) => {
        if (err instanceof Error && (err.name === 'CanceledError' || err.name === 'AbortError')) return;
        setLoyaltyPoints(null);
      });
    return () => controller.abort();
  }, [customer?.id]);

  useEffect(() => {
    if (cart.customerId && !cart.customer) {
      const controller = new AbortController();
      api.get(`/customers/${cart.customerId}`, { signal: controller.signal })
        .then(res => cart.setCustomer(res.data.customer))
        .catch(() => {});
      return () => controller.abort();
    }
  }, [cart.customerId, cart]);

  useEffect(() => {
    return () => {
      clearTimeout(debounceRef.current);
      requestAbortRef.current?.abort();
    };
  }, []);

  const searchByPhone = (p: string) => {
    clearTimeout(debounceRef.current);
    requestAbortRef.current?.abort();
    if (p.length < 3) {
      setMatched(null);
      setMatchedStats(null);
      setSearched(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const { data } = await api.get(`/loyalty/lookup?phone=${encodeURIComponent(p)}`);
        if (data.exists && data.customer) {
          setMatched(data.customer);
          setMatchedStats({
            visits: data.customer.visits_count || 0,
            totalSpent: data.customer.total_spent || 0,
            email: data.customer.email,
          });
          setLoyaltyPoints(data.customer.wallet_balance ?? null);
        } else {
          setMatched(null);
          setMatchedStats(null);
        }
        setSearched(true);
      } catch {
        setMatched(null);
        setMatchedStats(null);
        setSearched(true);
      }
    }, 250);
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setPhone(val);
    if (matched !== null) setMatched(null);
    if (searched) setSearched(false);
    searchByPhone(digitsOnly(val));
  };

  const handleSelectMatched = () => {
    if (!matched) return;
    cart.setCustomer(matched);
    setPhone('');
    setMatched(null);
    setMatchedStats(null);
    setSearched(false);
    toast.success(`Profile confirmed for ${matched.name}`);
    onSelected?.();
  };

  const handleSendSnsInvite = async () => {
    if (!phone.trim()) {
      toast.error('Please enter customer phone number');
      return;
    }
    setCreating(true);
    try {
      const { data } = await api.post('/loyalty/send-invite', { phone: phone.trim() });
      if (data.customer) {
        cart.setCustomer(data.customer);
      }
      setPhone('');
      setMatched(null);
      setMatchedStats(null);
      setSearched(false);
      toast.success(`📱 Amazon SNS SMS Invite Sent! Customer will fill Name & Email on their phone.`, { duration: 5000 });
      onSelected?.();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to dispatch Amazon SNS SMS invite');
    } finally {
      setCreating(false);
    }
  };

  const handleClear = () => cart.setCustomer(null);

  // ── Customer already selected ──────────────────────────────────────────────
  if (customer) {
    const hasTags = customer.tag_counts && Object.keys(customer.tag_counts).length > 0;

    if (variant === 'topbar') {
      return (
        <>
          <div className="min-h-10 flex items-center gap-2 px-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-lg min-w-0 w-full">
            <button
              onClick={() => setEditingCustomer(true)}
              title={t('editCustomer')}
              className="touch-target flex-1 min-w-0 justify-start gap-x-2 flex-wrap text-start flex items-center"
            >
              <span className="font-bold text-amber-950 dark:text-amber-200 text-sm truncate flex items-center gap-1">
                <User size={14} className="text-amber-700" />
                {customer.name}
              </span>
              <span className="text-stone-500 text-xs shrink-0"><Ltr>{customer.phone}</Ltr></span>
              {customer.email && (
                <span className="text-stone-400 text-xs shrink-0 truncate max-w-36 flex items-center gap-0.5">
                  <Mail size={11} /> {customer.email}
                </span>
              )}
              {!!loyaltyPoints && loyaltyPoints > 0 && (
                <span className="flex items-center gap-0.5 text-xs font-bold text-amber-800 dark:text-amber-300 bg-amber-200/60 dark:bg-amber-900/60 rounded-full px-2 py-0.5 shrink-0">
                  <Gift size={11} />
                  {loyaltyPoints} Pts
                </span>
              )}
              {hasTags && <TagBadges counts={customer.tag_counts!} />}
            </button>
            <button onClick={handleClear} className="touch-target rounded-full text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 shrink-0 ms-auto" aria-label={t('remove')}>
              <X size={16} />
            </button>
          </div>
          {editingCustomer && (
            <EditCustomerModal
              customer={customer}
              onClose={() => setEditingCustomer(false)}
              onSaved={(updated) => cart.setCustomer(updated)}
            />
          )}
        </>
      );
    }

    return (
      <div className="space-y-1">
        <div className="flex items-center justify-between px-3 py-2.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl text-sm">
          <button onClick={() => setEditingCustomer(true)} className="touch-target flex-1 min-w-0 justify-start gap-2 text-start">
            <span className="font-bold text-amber-950 dark:text-amber-100 truncate block">{customer.name}</span>
            <div className="flex items-center gap-2 text-xs text-stone-500 mt-0.5">
              {customer.phone && <span><Ltr>{customer.phone}</Ltr></span>}
              {customer.email && <span className="truncate">· {customer.email}</span>}
            </div>
          </button>
          <div className="flex items-center gap-2 shrink-0 ms-2">
            {!!loyaltyPoints && loyaltyPoints > 0 && (
              <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-900 bg-amber-200/80 rounded-full px-2 py-0.5">
                <Gift size={12} />
                {loyaltyPoints} Pts
              </span>
            )}
            <button onClick={handleClear} className="touch-target rounded-full text-stone-400 hover:text-stone-700" aria-label={t('remove')}>
              <X size={16} />
            </button>
          </div>
        </div>
        {hasTags && <TagBadges counts={customer.tag_counts!} />}
        {editingCustomer && (
          <EditCustomerModal
            customer={customer}
            onClose={() => setEditingCustomer(false)}
            onSaved={(updated) => cart.setCustomer(updated)}
          />
        )}
      </div>
    );
  }

  // ── Topbar variant ─────────────────────────────────────────────────────────
  if (variant === 'topbar') {
    return (
      <div className="relative w-full min-w-0">
        <div className="h-10 flex items-center gap-2 min-w-0">
          <div className="relative flex-1 min-w-44">
            <PhoneIcon size={14} className="absolute start-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              type="tel"
              inputMode="tel"
              value={phone}
              onChange={handlePhoneChange}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  if (matched) handleSelectMatched();
                  else if (searched) handleSendSnsInvite();
                }
              }}
              placeholder={dialCode ? `${dialCode} Customer Phone Number` : 'Customer Phone Number'}
              className="h-10 w-full ps-8 pe-3 text-sm border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 rounded-lg focus:ring-2 focus:ring-amber-700 focus:border-amber-700 outline-none font-medium"
              dir="ltr"
            />
          </div>

          {matched && (
            <button
              onClick={handleSelectMatched}
              className="touch-target shrink-0 px-3.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg whitespace-nowrap flex items-center gap-1.5 shadow-xs transition"
              title="Verify name and confirm profile"
            >
              <CheckCircle2 size={14} />
              Confirm ({matched.name})
            </button>
          )}

          {searched && !matched && phone.trim().length >= 4 && (
            <button
              onClick={handleSendSnsInvite}
              disabled={creating}
              className="touch-target shrink-0 px-3 bg-amber-800 hover:bg-amber-900 text-white text-xs font-bold rounded-lg disabled:opacity-50 whitespace-nowrap flex items-center gap-1.5 shadow-xs transition"
              title="Send Amazon SNS SMS to customer to complete profile"
            >
              <Send size={13} />
              {creating ? 'Sending SMS...' : '📱 Send Loyalty Invite SMS'}
            </button>
          )}
        </div>

        {searched && (
          <div className="absolute start-0 top-full mt-1 z-30 w-full max-w-md rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 p-3 shadow-xl">
            {matched ? (
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-emerald-700 dark:text-emerald-400 font-bold flex items-center gap-1">
                    <CheckCircle2 size={14} /> Verified Member Profile
                  </span>
                  {matchedStats && (
                    <span className="text-[11px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full">
                      {matched.wallet_balance || 0} Points · {matchedStats.visits} Visits
                    </span>
                  )}
                </div>
                <p className="text-sm font-black text-stone-900 dark:text-white">{matched.name}</p>
                <div className="text-xs text-stone-500 flex items-center gap-3">
                  <span>{matched.phone}</span>
                  {matched.email && <span>· {matched.email}</span>}
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-xs text-amber-900 dark:text-amber-200 font-bold">
                  <Sparkles size={14} className="text-amber-600" /> New Guest — Loyalty Invite
                </div>
                <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed">
                  &ldquo;We are running a loyalty program where repeat customers receive points on every product they buy. Would you like to subscribe?&rdquo;
                </p>
                <button
                  onClick={handleSendSnsInvite}
                  disabled={creating}
                  className="w-full bg-amber-800 hover:bg-amber-900 text-white font-bold text-xs py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition"
                >
                  <Send size={13} />
                  Send Amazon SNS SMS with Profile Completion Link
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // ── Default variant (used in cart / modals) ────────────────────────────────
  return (
    <div className="space-y-3">
      <div className="relative">
        <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 dark:text-stone-400 mb-1">
          Customer Phone Number
        </label>
        <div className="relative flex items-center">
          <PhoneIcon size={16} className="absolute start-3 text-stone-400" />
          <input
            type="tel"
            inputMode="numeric"
            value={phone}
            onChange={handlePhoneChange}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                if (matched) handleSelectMatched();
                else if (searched) handleSendSnsInvite();
              }
            }}
            placeholder={dialCode ? `${dialCode} 98765 43210` : 'Phone Number'}
            className="w-full ps-9 pe-3 py-2.5 text-sm border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 rounded-xl focus:ring-2 focus:ring-amber-700 outline-none font-medium"
            dir="ltr"
          />
        </div>
      </div>

      {searched && (
        <div className="space-y-2.5">
          {matched ? (
            <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1">
                  <CheckCircle2 size={14} /> Profile Found in Database
                </span>
                <span className="text-xs font-bold text-amber-900 bg-amber-100 px-2 py-0.5 rounded-full">
                  {matched.wallet_balance || 0} Loyalty Pts
                </span>
              </div>

              <div className="text-start">
                <p className="font-extrabold text-sm text-stone-900 dark:text-white">{matched.name}</p>
                <div className="text-xs text-stone-600 dark:text-stone-300 flex items-center gap-2 mt-0.5">
                  <span>{matched.phone}</span>
                  {matched.email && <span>· {matched.email}</span>}
                </div>
              </div>

              <button
                onClick={handleSelectMatched}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg py-2 flex items-center justify-center gap-1.5 shadow-xs transition"
              >
                <CheckCircle2 size={14} />
                Verify Name &amp; Confirm Profile ({matched.name})
              </button>
            </div>
          ) : (
            <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl p-3 space-y-2.5">
              <div className="flex items-center gap-1.5 text-xs font-black text-amber-900 dark:text-amber-200">
                <Gift size={14} className="text-amber-700" />
                <span>Hourglass Cafe Loyalty Program</span>
              </div>
              <p className="text-xs text-stone-600 dark:text-stone-300 leading-snug">
                &ldquo;We are running a loyalty program where repeat customers receive points on every product they buy. Would you like to subscribe?&rdquo;
              </p>
              <button
                onClick={handleSendSnsInvite}
                disabled={creating}
                className="w-full bg-amber-800 hover:bg-amber-900 text-white font-bold text-xs rounded-lg py-2.5 flex items-center justify-center gap-2 shadow-xs transition"
              >
                <Send size={14} />
                {creating ? 'Sending SMS...' : '📱 Send Loyalty Invite SMS via Amazon SNS'}
              </button>
              <p className="text-[11px] text-stone-500 text-center">
                SMS sends profile completion link for First Name, Last Name &amp; Email.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
