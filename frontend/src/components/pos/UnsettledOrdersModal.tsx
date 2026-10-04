'use client';

import { X, Utensils, CreditCard, Clock, FileText, CheckCircle2, User, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Order } from '@/lib/types';
import { useFormatCurrency } from '@/hooks/useFormatCurrency';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  orders: Order[];
  onCollectPayment: (order: Order) => void;
  currency: string;
}

export default function UnsettledOrdersModal({
  isOpen,
  onClose,
  orders,
  onCollectPayment,
  currency,
}: Props) {
  const currencyFmt = useFormatCurrency();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-card rounded-2xl p-6 w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl border border-border">
        {/* Header */}
        <div className="flex justify-between items-center pb-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 flex items-center justify-center font-bold">
              <Utensils size={20} />
            </div>
            <div>
              <h2 className="text-xl font-bold flex items-center gap-2">
                Unsettled Orders
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-purple-600 text-white font-semibold">
                  {orders.length}
                </span>
              </h2>
              <p className="text-xs text-muted-foreground">
                Orders served to customers — collect payment & generate invoice
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="touch-target rounded-full text-gray-400 hover:text-foreground active:bg-muted p-2"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Orders List */}
        <div className="flex-1 overflow-y-auto py-4 space-y-3.5 pr-1">
          {orders.length === 0 ? (
            <div className="text-center py-14 px-4 bg-muted/30 rounded-2xl border border-dashed border-border">
              <CheckCircle2 size={42} className="mx-auto text-muted-foreground/50 mb-3" />
              <h3 className="text-base font-semibold text-foreground">No Unsettled Orders</h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1">
                All served orders have been paid and settled. When an order is marked served, it will appear here for payment collection and invoice generation.
              </p>
            </div>
          ) : (
            orders.map((order) => {
              const isOnline = order.type === 'online' || Boolean(order.online_platform);
              const itemsCount = (order.items || []).reduce((sum, item) => sum + item.quantity, 0);
              const itemsSummary = (order.items || [])
                .map((i) => `${i.quantity}x ${i.product_name}`)
                .join(', ');

              return (
                <div
                  key={order.id}
                  className="bg-card rounded-xl border border-purple-200 dark:border-purple-800/40 p-4 shadow-xs hover:border-purple-400 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                      <span className="font-bold text-base text-foreground">
                        #{order.order_number}
                      </span>
                      {order.table?.name && (
                        <span className="text-xs px-2 py-0.5 rounded-md bg-orange-100 dark:bg-orange-950/60 text-orange-800 dark:text-orange-300 font-medium">
                          Table: {order.table.name}
                        </span>
                      )}
                      {isOnline && (
                        <span className="text-xs px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 font-medium">
                          🌐 {order.online_platform || 'Online Order'}
                        </span>
                      )}
                      {order.type === 'takeaway' && !isOnline && (
                        <span className="text-xs px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 font-medium">
                          🥡 Takeaway
                        </span>
                      )}
                      <span className="text-xs px-2 py-0.5 rounded-md bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 font-medium flex items-center gap-1">
                        <Utensils size={11} />
                        Served
                      </span>
                    </div>

                    <div className="text-xs text-muted-foreground line-clamp-2 mb-2">
                      <span className="font-semibold text-foreground/80">{itemsCount} items:</span>{' '}
                      {itemsSummary || 'Standard order items'}
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      {order.customer?.name && (
                        <span className="flex items-center gap-1">
                          <User size={12} />
                          {order.customer.name}
                        </span>
                      )}
                      {order.customer?.phone && (
                        <span className="flex items-center gap-1">
                          <Phone size={12} />
                          {order.customer.phone}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Clock size={12} />
                        {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>

                  <div className="flex md:flex-col items-center md:items-end justify-between gap-2.5 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-border">
                    <div className="text-end">
                      <span className="text-[11px] text-muted-foreground block">Amount Due</span>
                      <span className="text-lg font-bold text-foreground">
                        {currencyFmt(Number(order.total))}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <a
                        href={`/api/public/invoice/${order.order_number}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="touch-target px-2.5 py-1.5 rounded-lg border border-border bg-muted/40 hover:bg-muted text-xs font-medium text-foreground inline-flex items-center gap-1"
                        title="View & print digital invoice"
                      >
                        <FileText size={13} />
                        Invoice
                      </a>
                      <Button
                        onClick={() => onCollectPayment(order)}
                        className="bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs h-9 px-3.5 flex items-center gap-1.5 shadow-sm"
                      >
                        <CreditCard size={14} />
                        Collect Payment & Invoice
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-border flex justify-between items-center text-xs text-muted-foreground">
          <span>{orders.length} order{orders.length !== 1 ? 's' : ''} currently served & unpaid</span>
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
