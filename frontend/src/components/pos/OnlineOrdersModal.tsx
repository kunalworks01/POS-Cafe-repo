'use client';

import { useState } from 'react';
import {
  X,
  Globe,
  Utensils,
  CreditCard,
  Clock,
  FileText,
  User,
  Phone,
  ExternalLink,
  RefreshCw,
  ShoppingBag,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Order } from '@/lib/types';
import { useFormatCurrency } from '@/hooks/useFormatCurrency';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  orders: Order[];
  onMarkServed: (orderId: number) => Promise<void>;
  onCollectPayment: (order: Order) => void;
  currency: string;
  onRefresh?: () => void;
}

export default function OnlineOrdersModal({
  isOpen,
  onClose,
  orders,
  onMarkServed,
  onCollectPayment,
  currency,
  onRefresh,
}: Props) {
  const currencyFmt = useFormatCurrency();
  const [filter, setFilter] = useState<'active' | 'all'>('active');
  const [markingServedId, setMarkingServedId] = useState<number | null>(null);

  if (!isOpen) return null;

  const filteredOrders = orders.filter((o) => {
    if (filter === 'active') {
      return !['completed', 'cancelled'].includes(o.status);
    }
    return true;
  });

  const handleMarkServedClick = async (orderId: number) => {
    setMarkingServedId(orderId);
    try {
      await onMarkServed(orderId);
    } finally {
      setMarkingServedId(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-card rounded-2xl p-6 w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl border border-border">
        {/* Header */}
        <div className="flex justify-between items-start pb-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 flex items-center justify-center font-bold">
              <Globe size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold">Online Customer Orders</h2>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-600 text-white font-semibold">
                  {filteredOrders.length}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Orders placed via the customer web portal & online delivery platforms
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a
              href="/order"
              target="_blank"
              rel="noopener noreferrer"
              className="touch-target px-3 py-1.5 rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 text-xs font-semibold hover:bg-amber-100 inline-flex items-center gap-1.5"
            >
              <span>Customer Portal</span>
              <ExternalLink size={12} />
            </a>
            {onRefresh && (
              <button
                onClick={onRefresh}
                className="touch-target p-2 rounded-lg border border-border text-muted-foreground hover:bg-muted"
                title="Refresh orders"
              >
                <RefreshCw size={15} />
              </button>
            )}
            <button
              onClick={onClose}
              className="touch-target rounded-full text-gray-400 hover:text-foreground active:bg-muted p-2"
              aria-label="Close"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Filter Toggle */}
        <div className="flex items-center gap-2 pt-3 pb-1">
          <button
            onClick={() => setFilter('active')}
            className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
              filter === 'active'
                ? 'bg-amber-600 text-white'
                : 'bg-muted text-muted-foreground hover:text-foreground'
            }`}
          >
            Active Orders ({orders.filter((o) => !['completed', 'cancelled'].includes(o.status)).length})
          </button>
          <button
            onClick={() => setFilter('all')}
            className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
              filter === 'all'
                ? 'bg-amber-600 text-white'
                : 'bg-muted text-muted-foreground hover:text-foreground'
            }`}
          >
            All Online History ({orders.length})
          </button>
        </div>

        {/* Orders List */}
        <div className="flex-1 overflow-y-auto py-3 space-y-3 pr-1">
          {filteredOrders.length === 0 ? (
            <div className="text-center py-16 px-4 bg-muted/30 rounded-2xl border border-dashed border-border">
              <ShoppingBag size={42} className="mx-auto text-muted-foreground/50 mb-3" />
              <h3 className="text-base font-semibold text-foreground">No Online Orders Found</h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1">
                {filter === 'active'
                  ? 'No incoming or active online orders right now. Customers can browse your menu and order at /order.'
                  : 'No online orders recorded yet.'}
              </p>
              <div className="mt-4">
                <a
                  href="/order"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-brand font-semibold hover:underline"
                >
                  Open customer ordering page <ExternalLink size={12} />
                </a>
              </div>
            </div>
          ) : (
            filteredOrders.map((order) => {
              const itemsCount = (order.items || []).reduce((sum, item) => sum + item.quantity, 0);
              const items = order.items || [];
              const bills = order.bills && order.bills.length > 0 ? order.bills : order.bill ? [order.bill] : [];
              const isPaid = bills.length > 0 && bills.every((b) => b.payment_status === 'paid');
              const isServed = order.status === 'served';

              let statusColor = 'bg-gray-100 text-gray-700 dark:bg-muted dark:text-muted-foreground';
              if (order.status === 'pending') statusColor = 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300';
              if (order.status === 'preparing') statusColor = 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300';
              if (order.status === 'ready') statusColor = 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300';
              if (order.status === 'served') statusColor = 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300';
              if (order.status === 'completed') statusColor = 'bg-green-100 text-green-800 dark:bg-green-950/60 dark:text-green-300';

              return (
                <div
                  key={order.id}
                  className="bg-card rounded-xl border border-border hover:border-amber-400 dark:hover:border-amber-600 transition-colors p-4 shadow-xs"
                >
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-3 pb-3 border-b border-border/60">
                    <div>
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="font-bold text-base text-foreground">
                          #{order.order_number}
                        </span>
                        <span className="text-xs px-2.5 py-0.5 rounded-full font-medium capitalize flex items-center gap-1.5 shadow-2xs border border-current/20">
                          <span className="w-1.5 h-1.5 rounded-full bg-current" />
                          {order.status}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40 font-medium">
                          🌐 {order.online_platform || 'Hourglass Web'}
                        </span>
                        {isPaid ? (
                          <span className="text-xs px-2 py-0.5 rounded-md bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300 border border-green-200 font-medium">
                            ✓ Paid
                          </span>
                        ) : (
                          <span className="text-xs px-2 py-0.5 rounded-md bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border border-red-200 font-medium">
                            Unpaid
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mt-1">
                        {order.customer?.name && (
                          <span className="flex items-center gap-1 font-medium text-foreground">
                            <User size={13} />
                            {order.customer.name}
                          </span>
                        )}
                        {order.customer?.phone && (
                          <span className="flex items-center gap-1">
                            <Phone size={13} />
                            {order.customer.phone}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Clock size={13} />
                          {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>

                    <div className="text-start md:text-end">
                      <span className="text-xs text-muted-foreground block">Total Amount</span>
                      <span className="text-lg font-bold text-foreground">
                        {currencyFmt(Number(order.total))}
                      </span>
                    </div>
                  </div>

                  {/* Order Items */}
                  <div className="py-2.5 space-y-1 text-xs">
                    {items.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center text-muted-foreground">
                        <span>
                          <strong className="text-foreground">{item.quantity}x</strong> {item.product_name}
                          {item.addons && item.addons.length > 0 && (
                            <span className="text-[11px] text-muted-foreground/80 ms-1">
                              (+ {item.addons.map((a: any) => a.name).join(', ')})
                            </span>
                          )}
                          {item.special_instructions && (
                            <span className="text-[11px] text-amber-700 dark:text-amber-400 ms-1 italic">
                              Note: {item.special_instructions}
                            </span>
                          )}
                        </span>
                        <span className="font-medium text-foreground">
                          {currencyFmt(Number(item.total))}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Actions */}
                  <div className="pt-3 border-t border-border/60 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <a
                        href={`/api/public/invoice/${order.order_number}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="touch-target px-2.5 py-1.5 rounded-lg border border-border bg-muted/40 hover:bg-muted text-xs font-medium text-foreground inline-flex items-center gap-1"
                        title="View digital invoice"
                      >
                        <FileText size={13} />
                        Invoice Preview
                      </a>
                    </div>

                    <div className="flex items-center gap-2">
                      {!isServed && order.status !== 'completed' && order.status !== 'cancelled' && (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={markingServedId === order.id}
                          onClick={() => handleMarkServedClick(order.id)}
                          className="h-8 text-xs font-medium border-purple-300 dark:border-purple-700 text-purple-800 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-950/40 flex items-center gap-1"
                        >
                          <Utensils size={13} />
                          {markingServedId === order.id ? 'Marking...' : '🍽️ Mark Served'}
                        </Button>
                      )}

                      {!isPaid && order.status !== 'cancelled' && (
                        <Button
                          size="sm"
                          onClick={() => onCollectPayment(order)}
                          className="h-8 text-xs font-semibold bg-brand hover:bg-brand-hover text-white flex items-center gap-1.5"
                        >
                          <CreditCard size={13} />
                          {isServed ? 'Collect Payment & Invoice' : 'Take Payment & Invoice'}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-border flex justify-between items-center text-xs text-muted-foreground">
          <span>{filteredOrders.length} online orders shown</span>
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
