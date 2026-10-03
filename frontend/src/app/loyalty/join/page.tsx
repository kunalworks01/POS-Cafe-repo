'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Gift, CheckCircle2, Coffee, Sparkles, Mail, Phone,
  User, ArrowRight, ShieldCheck, Heart, Star, ArrowLeft
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';

export default function LoyaltyJoinPageWrapper() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-stone-100">
        <div className="w-8 h-8 border-4 border-amber-800 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <LoyaltyJoinContent />
    </Suspense>
  );
}

function LoyaltyJoinContent() {
  const searchParams = useSearchParams();
  const rawPhone = searchParams.get('phone') || '';
  const token = searchParams.get('token') || '';

  const [phone, setPhone] = useState(rawPhone);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [favoriteDrink, setFavoriteDrink] = useState('');
  const [birthday, setBirthday] = useState('');

  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [confirmedData, setConfirmedData] = useState<any>(null);

  useEffect(() => {
    if (token || rawPhone) {
      api.get(`/loyalty/join-info?token=${encodeURIComponent(token)}&phone=${encodeURIComponent(rawPhone)}`)
        .then(({ data }) => {
          if (data.phone) setPhone(data.phone);
          if (data.customer) {
            const parts = (data.customer.name || '').split(' ');
            if (parts[0] && parts[0] !== 'New' && parts[0] !== 'Valued') setFirstName(parts[0]);
            if (parts.slice(1).join(' ')) setLastName(parts.slice(1).join(' '));
            if (data.customer.email) setEmail(data.customer.email);
          }
        })
        .catch(() => {});
    }
  }, [token, rawPhone]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) {
      toast.error('Please enter your First and Last Name');
      return;
    }
    if (!phone.trim()) {
      toast.error('Phone Number is required');
      return;
    }
    if (!email.trim() || !email.includes('@') || !email.includes('.')) {
      toast.error('Please enter a valid email address');
      return;
    }

    setLoading(true);
    try {
      const { data } = await api.post('/loyalty/complete-profile', {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        phone: phone.trim(),
        email: email.trim().toLowerCase(),
        token,
        favorite_coffee: favoriteDrink,
        birthday,
      });

      setConfirmedData(data);
      setSubmitted(true);
      toast.success(data.message || '🎉 Loyalty profile confirmed!');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to complete profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-stone-100 text-stone-900 flex flex-col justify-between selection:bg-amber-800 selection:text-white font-sans">
      {/* Top Cafe Bar */}
      <header className="bg-stone-900 text-stone-100 border-b border-stone-800 py-4 px-4 sticky top-0 z-30 shadow-md">
        <div className="max-w-xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-amber-700/20 border border-amber-600/40 flex items-center justify-center text-amber-500">
              <Coffee size={18} />
            </div>
            <div>
              <h1 className="font-extrabold text-sm sm:text-base tracking-wider uppercase text-stone-100">Hourglass Cafe</h1>
              <p className="text-[10px] sm:text-xs text-amber-500 font-medium tracking-wide">Taste The Rhythm of Time</p>
            </div>
          </div>
          <div className="flex items-center gap-1 text-xs bg-amber-950/70 border border-amber-800/80 text-amber-400 px-2.5 py-1 rounded-full font-bold">
            <Gift size={13} />
            <span>50 Pts Bonus</span>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-xl w-full mx-auto p-4 sm:p-6 my-auto">
        {!submitted ? (
          <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-xl border border-stone-200/80 space-y-6">
            {/* Header banner */}
            <div className="text-center space-y-2">
              <div className="inline-flex items-center gap-1.5 bg-amber-50 border border-amber-200 text-amber-900 px-3 py-1 rounded-full text-xs font-bold">
                <Sparkles size={14} className="text-amber-600" />
                <span>Hourglass Loyalty Rewards</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-stone-900 tracking-tight">
                Complete Your Profile
              </h2>
              <p className="text-xs sm:text-sm text-stone-600 leading-relaxed max-w-md mx-auto">
                While we prepare your order, indulge in our rewards family! Earn points on every sip and bite.
              </p>
            </div>

            {/* Bonus Perk Highlight */}
            <div className="bg-gradient-to-r from-amber-50 via-orange-50 to-amber-100 border border-amber-300/80 rounded-2xl p-4 flex items-center gap-3.5 shadow-xs">
              <div className="w-12 h-12 rounded-xl bg-amber-800 text-white flex items-center justify-center shrink-0 shadow-sm font-black text-lg">
                50
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-amber-950">Instant Welcome Gift</p>
                <p className="text-xs text-amber-900/80 font-medium">50 points will be credited to your account upon submitting.</p>
              </div>
            </div>

            {/* Profile Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1.5">
                    First Name <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <User size={16} className="absolute start-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. Aarav"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="w-full ps-10 pe-4 py-3 bg-stone-50 border border-stone-300 rounded-xl text-sm font-medium focus:bg-white focus:ring-2 focus:ring-amber-800 focus:border-amber-800 outline-none transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1.5">
                    Last Name <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <User size={16} className="absolute start-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. Sharma"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="w-full ps-10 pe-4 py-3 bg-stone-50 border border-stone-300 rounded-xl text-sm font-medium focus:bg-white focus:ring-2 focus:ring-amber-800 focus:border-amber-800 outline-none transition"
                    />
                  </div>
                </div>
              </div>

              {/* Phone Number - Auto filled */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-stone-700">
                    Phone Number (Auto-Filled)
                  </label>
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    <CheckCircle2 size={11} /> Verified via SMS
                  </span>
                </div>
                <div className="relative">
                  <Phone size={16} className="absolute start-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
                  <input
                    type="tel"
                    required
                    readOnly
                    value={phone}
                    className="w-full ps-10 pe-4 py-3 bg-stone-100 border border-stone-300 rounded-xl text-sm font-bold text-stone-800 outline-none cursor-not-allowed"
                  />
                </div>
              </div>

              {/* Email Address - Required */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1.5">
                  Email Address <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Mail size={16} className="absolute start-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
                  <input
                    type="email"
                    required
                    placeholder="e.g. aarav.sharma@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full ps-10 pe-4 py-3 bg-stone-50 border border-stone-300 rounded-xl text-sm font-medium focus:bg-white focus:ring-2 focus:ring-amber-800 focus:border-amber-800 outline-none transition"
                  />
                </div>
                <p className="text-[11px] text-stone-500 mt-1">
                  📧 Your digital loyalty card and welcome gift will be emailed here.
                </p>
              </div>

              {/* Optional Favorite Drink */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1.5">
                  Favorite Cafe Item <span className="text-stone-400 font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Filter Coffee, Caramel Frappe, Nutella Waffle"
                  value={favoriteDrink}
                  onChange={(e) => setFavoriteDrink(e.target.value)}
                  className="w-full px-4 py-2.5 bg-stone-50 border border-stone-300 rounded-xl text-sm font-medium focus:bg-white focus:ring-2 focus:ring-amber-800 focus:border-amber-800 outline-none transition"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-amber-800 hover:bg-amber-900 active:bg-amber-950 disabled:opacity-50 text-white font-extrabold py-3.5 px-6 rounded-2xl text-sm transition shadow-lg hover:shadow-xl flex items-center justify-center gap-2 mt-4"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Confirm Profile &amp; Claim 50 Points</span>
                    <ArrowRight size={17} />
                  </>
                )}
              </button>

              <div className="text-center pt-2">
                <p className="text-[11px] text-stone-500">
                  By joining, you consent to receiving loyalty rewards, receipts, and feedback surveys from Hourglass Cafe.
                </p>
              </div>
            </form>
          </div>
        ) : (
          /* Confirmation & Digital Member Card Screen */
          <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-stone-200 space-y-6 text-center animate-in fade-in zoom-in-95 duration-300">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto shadow-inner">
              <CheckCircle2 size={36} />
            </div>

            <div className="space-y-1">
              <div className="inline-flex items-center gap-1 text-xs font-bold text-amber-800 bg-amber-50 px-3 py-1 rounded-full border border-amber-200">
                <Star size={13} className="fill-amber-600 text-amber-600" /> Member Profile Confirmed
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-stone-900">
                Welcome, {firstName}! 🎉
              </h2>
              <p className="text-xs sm:text-sm text-stone-600 max-w-sm mx-auto">
                Your profile has been authenticated. An email has been sent to <strong className="text-stone-900">{email}</strong>.
              </p>
            </div>

            {/* Digital Member Card */}
            <div className="bg-gradient-to-br from-stone-900 via-amber-950 to-stone-950 text-white rounded-2xl p-6 text-start shadow-xl relative overflow-hidden border border-amber-900/50">
              <div className="absolute top-0 end-0 w-32 h-32 bg-amber-600/10 rounded-full blur-2xl pointer-events-none" />
              
              <div className="flex justify-between items-start mb-6">
                <div>
                  <p className="text-[10px] tracking-widest uppercase font-bold text-amber-400">Hourglass Cafe</p>
                  <p className="text-xs text-stone-300 font-light">Loyalty Privilege Card</p>
                </div>
                <div className="bg-amber-500/20 border border-amber-400/30 px-2.5 py-0.5 rounded-full text-xs font-bold text-amber-300">
                  Active
                </div>
              </div>

              <div className="space-y-1 mb-6">
                <p className="text-xs text-stone-400 uppercase tracking-wider font-semibold">Member Name</p>
                <p className="text-lg font-black text-stone-100 tracking-wide">{firstName} {lastName}</p>
                <p className="text-xs text-stone-300 font-mono">{phone}</p>
              </div>

              <div className="flex justify-between items-end pt-3 border-t border-stone-800/80">
                <div>
                  <p className="text-[10px] text-stone-400 uppercase tracking-wider">Rewards Balance</p>
                  <p className="text-2xl font-black text-amber-400">50 <span className="text-xs font-semibold text-stone-300">PTS</span></p>
                </div>
                <div className="text-end">
                  <p className="text-[10px] text-stone-400 uppercase tracking-wider">Status</p>
                  <p className="text-xs font-bold text-emerald-400 flex items-center gap-1 justify-end">
                    <ShieldCheck size={13} /> Verified
                  </p>
                </div>
              </div>
            </div>

            {/* Next Action Buttons */}
            <div className="space-y-3 pt-2">
              <a
                href="/order"
                className="w-full bg-amber-800 hover:bg-amber-900 text-white font-bold py-3.5 px-6 rounded-2xl text-sm transition shadow-md flex items-center justify-center gap-2"
              >
                <Coffee size={16} />
                <span>Explore Cafe Menu &amp; Specials</span>
              </a>
              <button
                onClick={() => setSubmitted(false)}
                className="w-full bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold py-3 px-6 rounded-2xl text-xs transition"
              >
                Edit Profile Information
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-stone-900 text-stone-400 py-4 px-4 text-center text-xs border-t border-stone-800">
        <div className="max-w-xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <p><strong>Hourglass Cafe</strong> — Taste The Rhythm of Time</p>
          <p className="text-amber-500 font-medium">📞 +91 96431 77506 · 📸 @the_hourglasscafe</p>
        </div>
      </footer>
    </div>
  );
}
