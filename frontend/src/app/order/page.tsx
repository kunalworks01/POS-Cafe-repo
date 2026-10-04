'use client';

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  ShoppingBag, Flame, Sparkles, Clock, MapPin, Phone,
  Globe, Search, Plus, Minus, Trash2, CheckCircle2,
  Receipt, ArrowRight, ShieldCheck, ChevronRight, X,
  UtensilsCrossed, Gift, CreditCard, QrCode, Share2,
  Calendar, Moon, Sun, AlertCircle, RefreshCw
} from 'lucide-react';
import toast from 'react-hot-toast';

interface Product {
  id: string;
  category_id: string;
  name: string;
  description: string;
  price: number;
  tags?: string[];
  has_image: number;
  image_url?: string;
  is_featured?: boolean;
}

interface Category {
  id: string;
  name: string;
  sort_order: number;
}

interface Addon {
  id: string;
  name: string;
  price: number;
}

interface AddonGroup {
  id: string;
  name: string;
  min_selection: number;
  max_selection: number;
  addons: Addon[];
}

interface CartItem {
  id: string;
  product: Product;
  quantity: number;
  addons: Addon[];
  special_instructions: string;
}

interface OperationalStatus {
  isOpen: boolean;
  statusLabel: string;
  openTimeStr: string;
  closeTimeStr: string;
  estimatedWaitTime: string;
  isPreorder: boolean;
  nextOpeningTime: string;
  hoursNotice: string;
  queueNotice?: string;
}

export default function OrderPageWrapper() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-stone-50"><div className="w-8 h-8 border-4 border-amber-600 border-t-transparent rounded-full animate-spin" /></div>}>
      <OrderPageContent />
    </Suspense>
  );
}

function OrderPageContent() {
  const searchParams = useSearchParams();
  const initialStatusOrderNumber = searchParams.get('status');

  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [hotSellers, setHotSellers] = useState<Product[]>([]);
  const [addonGroups, setAddonGroups] = useState<AddonGroup[]>([]);
  const [operationalStatus, setOperationalStatus] = useState<OperationalStatus | null>(null);
  
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Cart state
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [submittingOrder, setSubmittingOrder] = useState(false);

  // Customer Checkout Details
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [pickupNotes, setPickupNotes] = useState('');
  const [loyaltySubscribed, setLoyaltySubscribed] = useState(true);
  const [paymentChoice, setPaymentChoice] = useState<'online' | 'pay_at_cafe'>('online');

  // Addon Modal state
  const [selectedProductForAddons, setSelectedProductForAddons] = useState<Product | null>(null);
  const [selectedAddons, setSelectedAddons] = useState<Addon[]>([]);

  // Placed Order Screen state
  const [placedOrder, setPlacedOrder] = useState<any>(null);
  const [orderTrackingNumber, setOrderTrackingNumber] = useState<string | null>(initialStatusOrderNumber);

  // Fetch Menu & Cafe Info
  const fetchCafeData = () => {
    Promise.all([
      fetch('/api/public/menu').then((res) => res.json()),
      fetch('/api/public/cafe-info').then((res) => res.json())
    ])
      .then(([menuData, infoData]) => {
        if (menuData.categories) setCategories(menuData.categories);
        if (menuData.products) setProducts(menuData.products);
        if (menuData.hotSellers) setHotSellers(menuData.hotSellers);
        if (menuData.addonGroups) setAddonGroups(menuData.addonGroups);
        if (infoData.operationalStatus) setOperationalStatus(infoData.operationalStatus);
      })
      .catch((err) => {
        console.error('Failed to load cafe data', err);
        toast.error('Unable to load cafe menu. Please refresh.');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchCafeData();
  }, []);

  // Fetch tracking order if param exists
  useEffect(() => {
    if (orderTrackingNumber) {
      fetch(`/api/public/orders/${orderTrackingNumber}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.order) {
            setPlacedOrder(data.order);
            if (data.order.operational_status) {
              setOperationalStatus(data.order.operational_status);
            }
          }
        })
        .catch(() => {});
    }
  }, [orderTrackingNumber]);

  // Gemini AI Chef Recommendations
  const [aiRecs, setAiRecs] = useState<any[]>([]);
  const [loadingAiRecs, setLoadingAiRecs] = useState(false);

  useEffect(() => {
    if (cart.length === 0) {
      setAiRecs([]);
      return;
    }

    const timer = setTimeout(() => {
      setLoadingAiRecs(true);
      fetch('/api/public/recommendations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cartItems: cart.map((c) => ({
            id: c.product.id,
            name: c.product.name,
            price: Number(c.product.price),
            quantity: c.quantity,
          })),
          customerName,
        }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data.recommendations)) {
            setAiRecs(data.recommendations);
          }
        })
        .catch(() => {})
        .finally(() => setLoadingAiRecs(false));
    }, 450);

    return () => clearTimeout(timer);
  }, [cart.map((i) => `${i.product.id}:${i.quantity}`).join(','), customerName]);

  // Filtered Products
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchCat = activeCategory === 'all' || p.category_id === activeCategory;
      const matchQuery =
        !searchQuery.trim() ||
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.description && p.description.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchCat && matchQuery;
    });
  }, [products, activeCategory, searchQuery]);

  // Cart Calculations
  const cartSubtotal = useMemo(() => {
    return cart.reduce((sum, item) => {
      const addonsCost = item.addons.reduce((aSum, a) => aSum + Number(a.price), 0);
      return sum + (Number(item.product.price) + addonsCost) * item.quantity;
    }, 0);
  }, [cart]);

  const cartItemCount = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.quantity, 0);
  }, [cart]);

  const taxAmount = Math.round(cartSubtotal * 0.05 * 100) / 100;
  const grandTotal = Math.round(cartSubtotal + taxAmount);

  // Add Item to Cart
  const handleAddToCart = (product: Product, chosenAddons: Addon[] = []) => {
    const eligibleForAddons = ['cat-burger', 'cat-sandwich', 'cat-momo', 'cat-fries'].includes(product.category_id);
    if (eligibleForAddons && chosenAddons.length === 0 && addonGroups.length > 0 && selectedProductForAddons === null) {
      setSelectedProductForAddons(product);
      setSelectedAddons([]);
      return;
    }

    setCart((prev) => {
      const addonKey = chosenAddons.map((a) => a.id).sort().join('-');
      const existingIdx = prev.findIndex(
        (i) => i.product.id === product.id && i.addons.map((a) => a.id).sort().join('-') === addonKey
      );

      if (existingIdx > -1) {
        const next = [...prev];
        next[existingIdx].quantity += 1;
        return next;
      }

      return [
        ...prev,
        {
          id: `${product.id}-${Date.now()}`,
          product,
          quantity: 1,
          addons: chosenAddons,
          special_instructions: '',
        },
      ];
    });

    toast.success(`Added ${product.name} to pickup bag`);
    setSelectedProductForAddons(null);
    setSelectedAddons([]);
  };

  const handleUpdateQuantity = (itemId: string, delta: number) => {
    setCart((prev) => {
      return prev
        .map((item) => {
          if (item.id === itemId) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean) as CartItem[];
    });
  };

  // Submit Order
  const handlePlacePickupOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) {
      toast.error('Your pickup bag is empty');
      return;
    }
    if (!customerPhone.trim()) {
      toast.error('Please enter your phone number for order updates');
      return;
    }

    setSubmittingOrder(true);
    try {
      const payload = {
        customer_name: customerName.trim() || 'Guest Customer',
        customer_phone: customerPhone.trim(),
        pickup_notes: pickupNotes.trim(),
        loyalty_subscribed: loyaltySubscribed,
        payment_choice: paymentChoice,
        items: cart.map((item) => ({
          product_id: item.product.id,
          quantity: item.quantity,
          addons: item.addons,
          special_instructions: item.special_instructions,
        })),
      };

      const res = await fetch('/api/public/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to place pickup order');
      }

      setPlacedOrder(data.order);
      setOrderTrackingNumber(data.order.order_number);
      setCart([]);
      setIsCartOpen(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      toast.success(
        data.order.is_preorder
          ? `🌙 Pre-order confirmed! Queue Priority #${data.order.queue_priority}`
          : 'Pickup order received by kitchen!'
      );
    } catch (err: any) {
      toast.error(err.message || 'Error submitting order');
    } finally {
      setSubmittingOrder(false);
    }
  };

  // ---------------------------------------------------------------------------
  // View 1: Order Confirmation & Live Tracking Screen
  // ---------------------------------------------------------------------------
  if (placedOrder) {
    const isPreorder = placedOrder.is_preorder;
    const isReady = placedOrder.status === 'ready' || placedOrder.status === 'completed';
    const isPreparing = placedOrder.status === 'preparing';
    const isPayAtCafe = placedOrder.payment_choice === 'pay_at_cafe';
    const upiLink = `upi://pay?pa=hourglasscafe@upi&pn=Hourglass%20Cafe&am=${placedOrder.total}&cu=INR&tn=Order%20${placedOrder.order_number}`;

    return (
      <div className="min-h-screen bg-stone-50 text-stone-900 pb-16">
        {/* Header */}
        <header className="bg-amber-900 text-amber-50 px-4 py-6 border-b border-amber-800 shadow-md">
          <div className="max-w-2xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src="/logo.svg" alt="Hourglass Cafe" className="w-12 h-12 bg-white rounded-full p-1" />
              <div>
                <h1 className="text-xl font-bold tracking-tight">Hourglass Cafe</h1>
                <p className="text-xs text-amber-200">Taste The Rhythm of Time</p>
              </div>
            </div>
            <button
              onClick={() => {
                setPlacedOrder(null);
                setOrderTrackingNumber(null);
              }}
              className="text-xs bg-amber-800 hover:bg-amber-700 px-3 py-1.5 rounded-lg border border-amber-700 transition font-medium"
            >
              Order More Items
            </button>
          </div>
        </header>

        <main className="max-w-2xl mx-auto px-4 mt-6 space-y-4">
          {/* Order Received Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-6 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full mb-4">
              <CheckCircle2 size={36} />
            </div>

            {isPreorder ? (
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-purple-800 bg-purple-100 px-3 py-1 rounded-full border border-purple-200">
                  <Moon size={14} /> Priority Pre-Order Confirmed
                </div>
                <div className="text-sm font-extrabold text-purple-900 mt-2 bg-purple-50 p-2.5 rounded-xl border border-purple-200">
                  ⚡ Opening Queue Priority: <span className="text-base text-purple-700 font-black">#{placedOrder.queue_priority || 1}</span> (First-Come, First-Served)
                </div>
              </div>
            ) : (
              <span className="text-xs font-semibold uppercase tracking-wider text-amber-700 bg-amber-50 px-3 py-1 rounded-full border border-amber-200">
                Live Pickup Order Confirmed
              </span>
            )}

            <h2 className="text-2xl font-black mt-3 text-stone-900">
              Order #{placedOrder.order_number}
            </h2>

            <p className="text-sm text-stone-600 mt-1">
              Estimated Ready Time:{' '}
              <strong className="text-amber-800 font-bold">
                {isPreorder ? placedOrder.estimated_ready_time || 'Today at 10:00 AM' : '15-20 Minutes'}
              </strong>
            </p>

            {/* Live Progress Bar */}
            <div className="mt-6 border-t border-b border-stone-100 py-4">
              <div className="flex justify-between items-center text-xs font-semibold mb-2">
                <span className="text-emerald-600 flex items-center gap-1">
                  <CheckCircle2 size={13} /> {isPreorder ? 'Pre-Order Queued' : 'Order Received'}
                </span>
                <span className={isPreparing || isReady ? 'text-amber-600 font-bold' : 'text-stone-400'}>
                  {isPreorder ? '10:00 AM Kitchen Opening' : '🍳 Preparing'}
                </span>
                <span className={isReady ? 'text-emerald-600 font-bold' : 'text-stone-400'}>
                  🛍️ Ready for Pickup
                </span>
              </div>
              <div className="w-full bg-stone-100 h-2.5 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 rounded-full ${
                    isReady ? 'w-full bg-emerald-500' : isPreparing ? 'w-2/3 bg-amber-500 animate-pulse' : 'w-1/3 bg-amber-600'
                  }`}
                />
              </div>
            </div>

            {/* Exact SMS Text Message Notification Summary */}
            <div className="mt-5 text-start bg-amber-50/70 border border-amber-200/80 rounded-xl p-4">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-800 mb-1">
                <Phone size={14} /> SMS Notification Sent To Customer ({placedOrder.customer_phone || 'Registered Phone'})
              </div>
              <p className="text-xs font-mono text-stone-800 bg-white p-3 rounded-lg border border-amber-200 leading-relaxed shadow-xs">
                {placedOrder.sms_notification ||
                  `"Hi, Your order at Hourglass cafe will be ready in 15-20 minutes, You can settle the bill here (https://pos.15.207.179.83.nip.io/order?status=${placedOrder.order_number}#pay) or at the counter with cash/UPI/Credit card/Debit Card, Post payment your invoice will be generated"`}
              </p>
            </div>
          </div>

          {/* Settle Bill / Payment Section */}
          <div id="pay" className="bg-white rounded-2xl shadow-sm border border-stone-200 p-6">
            <h3 className="font-bold text-base text-stone-900 flex items-center gap-2 mb-3">
              <CreditCard size={18} className="text-amber-700" /> Settle Your Bill
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Online Payment Card */}
              <div className={`border rounded-xl p-4 flex flex-col justify-between transition ${
                !isPayAtCafe ? 'border-amber-400 bg-amber-50/60 ring-2 ring-amber-400/30' : 'border-stone-200 bg-stone-50/50'
              }`}>
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900">
                      <QrCode size={16} /> Pay Online (UPI / QR Code)
                    </div>
                    {!isPayAtCafe && (
                      <span className="text-[10px] font-bold bg-amber-600 text-white px-2 py-0.5 rounded-full">
                        Selected
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-stone-600 mt-1">Instant via GPay, PhonePe, Paytm, BHIM</p>
                  <p className="text-lg font-black text-amber-900 mt-2">₹{placedOrder.total}</p>
                </div>
                <div className="mt-3 space-y-2">
                  <a
                    href={upiLink}
                    className="block w-full text-center bg-amber-700 hover:bg-amber-800 text-white text-xs font-bold py-2 rounded-lg transition shadow-xs"
                  >
                    📱 Pay with UPI App (₹{placedOrder.total})
                  </a>
                  <p className="text-[11px] text-center text-stone-500 font-mono">UPI ID: hourglasscafe@upi</p>
                </div>
              </div>

              {/* Pay at Counter Card */}
              <div className={`border rounded-xl p-4 flex flex-col justify-between transition ${
                isPayAtCafe ? 'border-amber-400 bg-amber-50/60 ring-2 ring-amber-400/30' : 'border-stone-200 bg-stone-50/50'
              }`}>
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-stone-800">
                      <Receipt size={16} /> Pay at Cafe Counter
                    </div>
                    {isPayAtCafe && (
                      <span className="text-[10px] font-bold bg-stone-800 text-white px-2 py-0.5 rounded-full">
                        Selected
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-stone-600 mt-1">Cash, Credit Card, Debit Card, or POS UPI upon pickup</p>
                  <p className="text-lg font-black text-stone-900 mt-2">₹{placedOrder.total}</p>
                </div>
                <div className="mt-3">
                  <div className="w-full text-center bg-stone-100 border border-stone-300 text-stone-800 text-xs font-semibold py-2 rounded-lg">
                    ✓ Settle at Counter on Pickup
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Itemized Order Details */}
          <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-6">
            <h3 className="font-bold text-base text-stone-900 flex items-center gap-2 mb-4">
              <Receipt size={18} className="text-amber-700" /> Order Summary
            </h3>
            <div className="divide-y divide-stone-100">
              {placedOrder.items?.map((item: any, idx: number) => (
                <div key={idx} className="py-2.5 flex justify-between items-start text-sm">
                  <div>
                    <span className="font-semibold text-stone-800">
                      {item.quantity}× {item.product_name}
                    </span>
                    {item.addons && item.addons.length > 0 && (
                      <div className="text-xs text-amber-700 mt-0.5">
                        {item.addons.map((a: any) => `+ ${a.name}`).join(', ')}
                      </div>
                    )}
                  </div>
                  <span className="font-bold text-stone-900">₹{item.total}</span>
                </div>
              ))}
            </div>

            <div className="border-t border-stone-200 mt-4 pt-3 space-y-1.5 text-sm">
              <div className="flex justify-between text-stone-500">
                <span>Subtotal</span>
                <span>₹{placedOrder.subtotal}</span>
              </div>
              <div className="flex justify-between text-stone-500">
                <span>GST (5%)</span>
                <span>₹{placedOrder.tax_amount}</span>
              </div>
              <div className="flex justify-between text-base font-black text-stone-900 border-t border-stone-200 pt-2">
                <span>Total Amount</span>
                <span className="text-amber-800 font-black">₹{placedOrder.total}</span>
              </div>
            </div>

            {/* Loyalty points earned */}
            <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs font-semibold text-emerald-800">
              <span className="flex items-center gap-1.5"><Gift size={15} /> Loyalty Points Earned</span>
              <span className="bg-emerald-200 text-emerald-900 px-2 py-0.5 rounded-full font-bold">
                +{placedOrder.items?.reduce((s: number, i: any) => s + (i.quantity || 1), 0) || 2} Points
              </span>
            </div>

            <div className="mt-6 flex flex-col sm:flex-row gap-2">
              <a
                href={`/api/public/invoice/${placedOrder.order_number}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 bg-amber-800 hover:bg-amber-900 text-white py-2.5 rounded-xl text-sm font-semibold transition text-center shadow-xs flex items-center justify-center gap-1.5"
              >
                <Receipt size={16} /> View Digital Tax Invoice
              </a>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(window.location.href);
                  toast.success('Order tracking link copied to clipboard');
                }}
                className="border border-stone-300 hover:bg-stone-50 text-stone-700 px-4 py-2.5 rounded-xl text-sm font-medium transition flex items-center justify-center gap-1.5"
                title="Share Order Link"
              >
                <Share2 size={16} /> Copy Order Link
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // View 2: Main Menu & Online Ordering Experience
  // ---------------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 flex flex-col">
      {/* Top Brand Banner */}
      <header className="bg-gradient-to-r from-amber-950 via-amber-900 to-amber-950 text-white shadow-md sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 py-3 sm:py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo.svg" alt="Hourglass Cafe" className="w-10 h-10 sm:w-12 sm:h-12 bg-white rounded-full p-1 shadow-sm" />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-black tracking-tight">Hourglass Cafe</h1>
                {operationalStatus?.isPreorder ? (
                  <span className="bg-purple-500/20 text-purple-200 border border-purple-400/40 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Moon size={11} /> Pre-Orders Open
                  </span>
                ) : (
                  <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Sun size={11} /> Kitchen Open Now
                  </span>
                )}
              </div>
              <p className="text-xs text-amber-200/90 hidden sm:block">Taste The Rhythm of Time · Online Ordering Portal</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden md:flex flex-col text-end text-xs text-amber-200">
              <span className="flex items-center justify-end gap-1 font-semibold text-white">
                <Clock size={13} className="text-amber-400" />
                {operationalStatus?.isPreorder ? `Opens: ${operationalStatus?.nextOpeningTime}` : 'Prep: 15-20 Mins'}
              </span>
              <span>Daily: 10:00 AM - 11:00 PM</span>
            </div>

            {/* Bag Button */}
            <button
              onClick={() => setIsCartOpen(true)}
              className="relative flex items-center gap-2 bg-amber-600 hover:bg-amber-500 text-white font-bold px-3.5 py-2 rounded-xl text-xs sm:text-sm shadow-md transition active:scale-95"
            >
              <ShoppingBag size={18} />
              <span>Bag</span>
              {cartItemCount > 0 && (
                <span className="bg-white text-amber-900 text-xs font-black px-1.5 py-0.5 rounded-full">
                  {cartItemCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Operational Status / Pre-Order Alert Banner */}
        {operationalStatus && (
          <div className={`px-4 py-2 text-xs font-medium border-t flex items-center justify-center gap-2 text-center ${
            operationalStatus.isPreorder
              ? 'bg-purple-950/90 text-purple-100 border-purple-800'
              : 'bg-amber-800/80 text-amber-100 border-amber-700/50'
          }`}>
            {operationalStatus.isPreorder ? (
              <>
                <Moon size={14} className="text-purple-300 shrink-0" />
                <span>
                  <strong>Closed for Live Prep:</strong> {operationalStatus.hoursNotice}{' '}
                  <span className="underline decoration-purple-400 font-bold">First-Come, First-Served Queue Active</span>
                </span>
              </>
            ) : (
              <>
                <Gift size={14} className="text-amber-300 shrink-0" />
                <span>
                  <strong>Hourglass Loyalty Program:</strong> Repeat customers earn points on every product bought, redeemable for discounts on overall price!
                </span>
              </>
            )}
          </div>
        )}
      </header>

      {/* Main Content Area */}
      <main className="max-w-6xl mx-auto px-4 py-6 flex-1 w-full space-y-8">
        {/* Search & Location Pill */}
        <div className="flex flex-col sm:flex-row gap-3 items-stretch justify-between">
          <div className="relative flex-1">
            <Search size={18} className="absolute start-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              placeholder="Search burgers, momos, pasta, shakes, chai..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-600 focus:border-transparent shadow-xs"
            />
          </div>
          <div className="flex items-center gap-2 text-xs font-semibold text-stone-600 bg-white px-3 py-2 rounded-xl border border-stone-200 shrink-0">
            <MapPin size={14} className="text-amber-700" />
            <span>Store Pickup: C-42, Shastri Nagar, Ghaziabad, UP</span>
          </div>
        </div>

        {/* Hot Sellers / Famous Section */}
        {hotSellers.length > 0 && !searchQuery && (
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex items-center justify-center w-7 h-7 bg-orange-100 text-orange-600 rounded-lg">
                  <Flame size={18} />
                </span>
                <h2 className="text-lg font-black text-stone-900">Famous & Hot Sellers</h2>
              </div>
              <span className="text-xs text-stone-500 font-medium">Hourglass Signatures</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {hotSellers.slice(0, 6).map((product) => (
                <div
                  key={product.id}
                  className="bg-white rounded-xl border border-stone-200 overflow-hidden shadow-xs hover:shadow-md transition flex flex-col group"
                >
                  <div className="aspect-square relative overflow-hidden bg-stone-100">
                    <img
                      src={`/images/products/${product.id}.webp`}
                      alt={product.name}
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = '/images/products/cat-burger_base.webp';
                      }}
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                    />
                    <span className="absolute top-1.5 start-1.5 bg-amber-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md shadow-xs">
                      🔥 Top Seller
                    </span>
                  </div>
                  <div className="p-2.5 flex-1 flex flex-col justify-between">
                    <div>
                      <h4 className="font-bold text-xs text-stone-900 line-clamp-1">{product.name}</h4>
                      <p className="text-[11px] text-stone-500 line-clamp-1 mt-0.5">{product.description}</p>
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="font-black text-xs text-amber-900">₹{product.price}</span>
                      <button
                        onClick={() => handleAddToCart(product)}
                        className="bg-amber-100 hover:bg-amber-200 text-amber-900 text-xs font-bold px-2 py-1 rounded-md transition"
                      >
                        + Add
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Category Navigation Pills */}
        <section className="space-y-3">
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
            <button
              onClick={() => setActiveCategory('all')}
              className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition ${
                activeCategory === 'all'
                  ? 'bg-amber-800 text-white shadow-sm'
                  : 'bg-white text-stone-700 border border-stone-200 hover:bg-stone-100'
              }`}
            >
              All Items ({products.length})
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition ${
                  activeCategory === cat.id
                    ? 'bg-amber-800 text-white shadow-sm'
                    : 'bg-white text-stone-700 border border-stone-200 hover:bg-stone-100'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>

          {/* Product Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredProducts.map((product) => (
              <div
                key={product.id}
                className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-xs hover:shadow-md transition flex flex-col"
              >
                <div className="h-44 w-full relative overflow-hidden bg-stone-100">
                  <img
                    src={`/images/products/${product.id}.webp`}
                    alt={product.name}
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = '/images/products/cat-burger_base.webp';
                    }}
                    className="w-full h-full object-cover"
                  />
                  {product.is_featured && (
                    <span className="absolute top-2.5 start-2.5 bg-amber-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-xs">
                      ⭐ Chef Special
                    </span>
                  )}
                  <span className="absolute bottom-2.5 start-2.5 bg-black/60 backdrop-blur-xs text-white text-xs font-bold px-2 py-0.5 rounded-md">
                    ₹{product.price}
                  </span>
                </div>

                <div className="p-4 flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="font-bold text-sm text-stone-900">{product.name}</h3>
                    <p className="text-xs text-stone-500 mt-1 line-clamp-2 leading-relaxed">
                      {product.description || 'Deliciously prepared with authentic ingredients at Hourglass Cafe.'}
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-stone-100 flex items-center justify-between">
                    <span className="text-xs text-stone-400 font-medium">100% Vegetarian</span>
                    <button
                      onClick={() => handleAddToCart(product)}
                      className="bg-amber-800 hover:bg-amber-900 active:scale-95 text-white font-bold text-xs px-3.5 py-1.5 rounded-xl transition flex items-center gap-1 shadow-xs"
                    >
                      <Plus size={14} /> Add to Pickup
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* Floating Bottom Bag Bar on Mobile */}
      {cartItemCount > 0 && !isCartOpen && (
        <div className="fixed bottom-4 inset-x-4 max-w-lg mx-auto z-40">
          <button
            onClick={() => setIsCartOpen(true)}
            className="w-full bg-amber-900 hover:bg-amber-800 text-white px-5 py-3.5 rounded-2xl shadow-xl flex items-center justify-between font-bold text-sm transition active:scale-98 border border-amber-700"
          >
            <div className="flex items-center gap-2.5">
              <span className="bg-amber-700 px-2 py-0.5 rounded-lg text-xs font-black">
                {cartItemCount} {cartItemCount === 1 ? 'item' : 'items'}
              </span>
              <span>View Pickup Bag</span>
            </div>
            <div className="flex items-center gap-1 text-amber-200">
              <span>₹{grandTotal}</span>
              <ChevronRight size={18} />
            </div>
          </button>
        </div>
      )}

      {/* Addon Customizer Modal */}
      {selectedProductForAddons && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setSelectedProductForAddons(null)}
              className="absolute top-4 end-4 text-stone-400 hover:text-stone-700"
            >
              <X size={20} />
            </button>
            <div className="flex items-center gap-3 mb-4">
              <img
                src={`/images/products/${selectedProductForAddons.id}.webp`}
                alt={selectedProductForAddons.name}
                className="w-14 h-14 rounded-xl object-cover"
              />
              <div>
                <h3 className="font-bold text-base text-stone-900">{selectedProductForAddons.name}</h3>
                <p className="text-xs text-amber-800 font-bold">Base Price: ₹{selectedProductForAddons.price}</p>
              </div>
            </div>

            <p className="text-xs font-bold uppercase tracking-wider text-stone-500 mb-2">
              Customize Your Order (Optional Add-ons)
            </p>

            <div className="space-y-3 mb-6">
              {addonGroups.map((group) => (
                <div key={group.id} className="border border-stone-200 rounded-xl p-3 bg-stone-50">
                  <h4 className="text-xs font-bold text-stone-800 mb-2">{group.name}</h4>
                  <div className="space-y-1.5">
                    {group.addons.map((addon) => {
                      const isChecked = selectedAddons.some((a) => a.id === addon.id);
                      return (
                        <label
                          key={addon.id}
                          className="flex items-center justify-between text-xs p-2 rounded-lg bg-white border border-stone-100 cursor-pointer hover:border-amber-400 transition"
                        >
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedAddons([...selectedAddons, addon]);
                                } else {
                                  setSelectedAddons(selectedAddons.filter((a) => a.id !== addon.id));
                                }
                              }}
                              className="rounded text-amber-800 focus:ring-amber-600"
                            />
                            <span className="font-medium text-stone-800">{addon.name}</span>
                          </div>
                          <span className="font-bold text-amber-900">+₹{addon.price}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={() => handleAddToCart(selectedProductForAddons, selectedAddons)}
              className="w-full bg-amber-800 hover:bg-amber-900 text-white font-bold py-3 rounded-xl text-sm transition shadow-sm"
            >
              Add to Bag (₹
              {Number(selectedProductForAddons.price) +
                selectedAddons.reduce((s, a) => s + Number(a.price), 0)}
              )
            </button>
          </div>
        </div>
      )}

      {/* Cart & Pickup Checkout Drawer */}
      {isCartOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex justify-end">
          <div className="bg-white w-full max-w-md h-full flex flex-col shadow-2xl">
            {/* Drawer Header */}
            <div className="p-4 border-b border-stone-200 flex items-center justify-between bg-stone-50">
              <div className="flex items-center gap-2">
                <ShoppingBag size={18} className="text-amber-800" />
                <h3 className="font-black text-base text-stone-900">Your Pickup Bag</h3>
                <span className="text-xs bg-amber-100 text-amber-900 font-bold px-2 py-0.5 rounded-full">
                  {cartItemCount}
                </span>
              </div>
              <button
                onClick={() => setIsCartOpen(false)}
                className="text-stone-400 hover:text-stone-700 p-1"
              >
                <X size={20} />
              </button>
            </div>

            {/* Operational notice inside bag */}
            {operationalStatus?.isPreorder && (
              <div className="bg-purple-50 border-b border-purple-200 p-3 text-xs text-purple-900 flex items-start gap-2">
                <Moon size={15} className="text-purple-700 shrink-0 mt-0.5" />
                <div>
                  <strong className="block">🌙 Priority Pre-Order Active</strong>
                  <span>Your order will be queued for prep at {operationalStatus.nextOpeningTime} on a First-Come, First-Served basis.</span>
                </div>
              </div>
            )}

            {/* Cart Items List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {cart.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-stone-400 gap-2">
                  <ShoppingBag size={48} className="text-stone-300" />
                  <p className="text-sm font-semibold">Your pickup bag is empty</p>
                  <p className="text-xs text-stone-400">Add delicious burgers, momos, or chai</p>
                </div>
              ) : (
                cart.map((item) => (
                  <div key={item.id} className="border border-stone-200 rounded-xl p-3 bg-stone-50/50">
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex-1">
                        <h4 className="font-bold text-sm text-stone-900">{item.product.name}</h4>
                        <p className="text-xs font-semibold text-amber-900 mt-0.5">₹{item.product.price}</p>
                        {item.addons.length > 0 && (
                          <p className="text-[11px] text-stone-500 mt-0.5">
                            {item.addons.map((a) => `+ ${a.name} (₹${a.price})`).join(', ')}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 bg-white border border-stone-200 rounded-lg p-1">
                        <button
                          onClick={() => handleUpdateQuantity(item.id, -1)}
                          className="w-6 h-6 flex items-center justify-center text-stone-600 hover:bg-stone-100 rounded"
                        >
                          <Minus size={13} />
                        </button>
                        <span className="text-xs font-bold w-4 text-center">{item.quantity}</span>
                        <button
                          onClick={() => handleUpdateQuantity(item.id, 1)}
                          className="w-6 h-6 flex items-center justify-center text-stone-600 hover:bg-stone-100 rounded"
                        >
                          <Plus size={13} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Gemini AI Recommended Pairings */}
            {cart.length > 0 && (aiRecs.length > 0 || loadingAiRecs) && (
              <div className="mx-4 mb-2 p-3 bg-amber-50/80 border border-amber-200/80 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                    <Sparkles size={13} className={`text-amber-600 ${loadingAiRecs ? 'animate-spin' : 'animate-pulse'}`} />
                    Chef's Recommended Pairings
                  </span>
                  {loadingAiRecs && <span className="text-[10px] text-amber-700">Finding pairings...</span>}
                </div>

                <div className="space-y-1.5">
                  {aiRecs.map((rec: any) => {
                    const matchedProd = products.find(
                      (p) => p.id === rec.productId || p.name.toLowerCase() === rec.name?.toLowerCase()
                    );
                    if (!matchedProd) return null;

                    return (
                      <div
                        key={rec.productId}
                        className="flex items-center justify-between bg-white p-2 rounded-lg border border-amber-100 shadow-2xs"
                      >
                        <div className="min-w-0 flex-1 pr-2">
                          <p className="text-xs font-bold text-stone-900 truncate">{matchedProd.name}</p>
                          <p className="text-[10px] text-stone-500 truncate">{rec.reason}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs font-black text-amber-900">₹{matchedProd.price}</span>
                          <button
                            type="button"
                            onClick={() => {
                              handleAddToCart(matchedProd, []);
                              toast.success(`Added ${matchedProd.name} to bag!`);
                            }}
                            className="bg-amber-800 hover:bg-amber-900 text-white text-[11px] font-bold px-2.5 py-1 rounded-md transition active:scale-95 flex items-center gap-1"
                          >
                            <Plus size={11} /> Add
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Checkout Form & Total */}
            {cart.length > 0 && (
              <form onSubmit={handlePlacePickupOrder} className="border-t border-stone-200 p-4 bg-stone-50 space-y-3 max-h-[60vh] overflow-y-auto">
                <div className="space-y-2">
                  <input
                    type="text"
                    required
                    placeholder="Your Full Name *"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-stone-200 rounded-lg text-xs focus:ring-2 focus:ring-amber-600 outline-none"
                  />
                  <input
                    type="tel"
                    required
                    placeholder="Phone Number (for SMS Tracking & Loyalty) *"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-stone-200 rounded-lg text-xs focus:ring-2 focus:ring-amber-600 outline-none"
                  />
                  <input
                    type="text"
                    placeholder="Special Pickup Notes (Optional)"
                    value={pickupNotes}
                    onChange={(e) => setPickupNotes(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-stone-200 rounded-lg text-xs focus:ring-2 focus:ring-amber-600 outline-none"
                  />
                </div>

                {/* Payment Method Selector */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-stone-700 block">Payment Option</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setPaymentChoice('online')}
                      className={`p-2.5 rounded-xl border text-start flex flex-col justify-between transition ${
                        paymentChoice === 'online'
                          ? 'border-amber-600 bg-amber-50 ring-1 ring-amber-600'
                          : 'border-stone-200 bg-white hover:bg-stone-50'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 text-xs font-bold text-amber-950">
                        <QrCode size={14} className="text-amber-700" /> Pay Online
                      </div>
                      <span className="text-[10px] text-stone-500 mt-1">UPI, QR Code, Instant</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPaymentChoice('pay_at_cafe')}
                      className={`p-2.5 rounded-xl border text-start flex flex-col justify-between transition ${
                        paymentChoice === 'pay_at_cafe'
                          ? 'border-amber-600 bg-amber-50 ring-1 ring-amber-600'
                          : 'border-stone-200 bg-white hover:bg-stone-50'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 text-xs font-bold text-stone-900">
                        <Receipt size={14} className="text-amber-700" /> Pay at Cafe
                      </div>
                      <span className="text-[10px] text-stone-500 mt-1">Cash/Card at Pickup</span>
                    </button>
                  </div>
                </div>

                {/* Loyalty subscription checkbox */}
                <label className="flex items-start gap-2 bg-amber-100/60 border border-amber-200 rounded-xl p-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={loyaltySubscribed}
                    onChange={(e) => setLoyaltySubscribed(e.target.checked)}
                    className="rounded text-amber-800 focus:ring-amber-600 mt-0.5"
                  />
                  <div className="text-[11px] leading-tight">
                    <span className="font-bold text-amber-950 block">Join Hourglass Loyalty Program</span>
                    <span className="text-amber-800">
                      Earn reward points on every product bought, redeemable for discounts on future cafe bills!
                    </span>
                  </div>
                </label>

                {/* Price Breakdown */}
                <div className="space-y-1 text-xs text-stone-600 pt-1">
                  <div className="flex justify-between">
                    <span>Items Subtotal</span>
                    <span>₹{cartSubtotal}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>GST (5%)</span>
                    <span>₹{taxAmount}</span>
                  </div>
                  <div className="flex justify-between font-black text-sm text-stone-900 pt-1 border-t border-stone-200">
                    <span>Grand Total</span>
                    <span className="text-amber-900 font-black">₹{grandTotal}</span>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submittingOrder}
                  className="w-full bg-amber-800 hover:bg-amber-900 disabled:opacity-50 text-white font-bold py-3 rounded-xl text-sm transition shadow-md flex items-center justify-center gap-2"
                >
                  {submittingOrder ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>
                        {operationalStatus?.isPreorder
                          ? `Place Priority Pre-Order (₹${grandTotal})`
                          : `Place Pickup Order (₹${grandTotal})`}
                      </span>
                      <ArrowRight size={16} />
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="bg-stone-900 text-stone-400 py-6 border-t border-stone-800 text-xs">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <img src="/logo.svg" alt="Hourglass" className="w-6 h-6 rounded-full bg-white p-0.5" />
            <span className="font-bold text-white">Hourglass Cafe</span>
            <span>— Taste The Rhythm of Time</span>
          </div>
          <div className="flex items-center gap-4 text-stone-400">
            <span className="flex items-center gap-1"><Phone size={12} /> +91 96431 77506</span>
            <span className="flex items-center gap-1"><Globe size={12} /> @the_hourglasscafe</span>
            <span className="text-amber-500 font-medium">Powered by Pro-Cafe</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
