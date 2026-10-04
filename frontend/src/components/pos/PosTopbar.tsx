'use client';

import PrinterStatus from './PrinterStatus';
import CustomerSearch from './CustomerSearch';
import { useCartStore } from '@/store/cart';
import { useAuthStore } from '@/store/auth';
import { usePosSettingsStore } from '@/store/pos-settings';
import { Banknote, LayoutGrid, Maximize2, Minimize2, LockOpen, Lock, Globe, Utensils } from 'lucide-react';
import type { Table } from '@/lib/types';
import { useTranslations } from 'use-intl';

interface Props {
  tables: Table[];
  onShowTablePicker: () => void;
  onShowCashMovement: () => void;
  onShowShift: () => void;
  shiftHasOpenSession: boolean;
  shiftLoading: boolean;
  shiftError: string | null;
  canUseShift: boolean;
  fullscreen: boolean;
  onToggleFullscreen: () => void;
  unsettledCount?: number;
  onShowUnsettled?: () => void;
  onlineOrdersCount?: number;
  onShowOnlineOrders?: () => void;
}

export default function PosTopbar({
  tables,
  onShowTablePicker,
  onShowCashMovement,
  onShowShift,
  shiftHasOpenSession,
  shiftLoading,
  shiftError,
  canUseShift,
  fullscreen,
  onToggleFullscreen,
  unsettledCount = 0,
  onShowUnsettled,
  onlineOrdersCount = 0,
  onShowOnlineOrders,
}: Props) {
  const cart = useCartStore();
  const { currentTenant } = useAuthStore();
  const tablesRequired = usePosSettingsStore((s) => s.tablesRequired);
  const t = useTranslations('pos');
  const tDashboard = useTranslations('dashboard');
  const isRestaurant = (currentTenant?.business_type ?? 'restaurant') === 'restaurant';
  const showTableBtn = isRestaurant && cart.orderType === 'dine_in' && tablesRequired;

  return (
    <div className="flex items-center gap-3 border-b bg-card shrink-0 px-4 py-2.5">
      <div className="flex-1 min-w-0">
        <CustomerSearch variant="topbar" />
      </div>

      {/* Select Table — between customer search and printer */}
      {showTableBtn && (
        <button
          onClick={onShowTablePicker}
          className={`touch-target shrink-0 gap-1.5 px-3 text-sm rounded-lg border font-medium transition-colors whitespace-nowrap ${
            cart.tableId
              ? 'bg-orange-500 text-white border-orange-500 hover:bg-orange-600'
              : 'bg-amber-50 border-amber-400 text-amber-700 hover:bg-amber-100'
          }`}
        >
          <LayoutGrid size={14} />
          {cart.tableId
            ? t('tableLabel', { name: tables.find(t => t.id === cart.tableId)?.name || cart.tableId })
            : t('selectTable')}
        </button>
      )}

      <button
        type="button"
        onClick={onShowCashMovement}
        className="touch-target shrink-0 gap-1.5 rounded-lg border border-border bg-card px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted active:bg-muted whitespace-nowrap"
        title={tDashboard('cashMovement')}
        aria-label={tDashboard('cashMovement')}
      >
        <Banknote size={16} />
        <span className="hidden sm:inline">{tDashboard('cashMovement')}</span>
      </button>

      {canUseShift && (
        <button
          type="button"
          onClick={onShowShift}
          disabled={shiftLoading}
          className="touch-target shrink-0 gap-1.5 rounded-lg border border-border bg-card px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted active:bg-muted whitespace-nowrap disabled:opacity-50"
          title={shiftError ?? (shiftHasOpenSession ? tDashboard('closeShiftSession') : tDashboard('openShift'))}
          aria-label={shiftHasOpenSession ? tDashboard('closeShiftSession') : tDashboard('openShift')}
        >
          {shiftHasOpenSession ? <Lock size={16} /> : <LockOpen size={16} />}
          <span className="hidden sm:inline">{shiftHasOpenSession ? tDashboard('closeShiftSession') : tDashboard('openShift')}</span>
        </button>
      )}

      {onShowUnsettled && (
        <button
          type="button"
          onClick={onShowUnsettled}
          className={`touch-target shrink-0 gap-1.5 rounded-lg border px-3 text-sm font-semibold transition-colors whitespace-nowrap flex items-center shadow-xs ${
            unsettledCount > 0
              ? 'border-purple-300 dark:border-purple-700 bg-purple-50 dark:bg-purple-950/40 text-purple-900 dark:text-purple-200 hover:bg-purple-100'
              : 'border-border bg-card text-muted-foreground hover:bg-muted'
          }`}
          title="Orders served and awaiting bill payment & invoice"
          aria-label="Unsettled Orders"
        >
          <Utensils size={15} className={unsettledCount > 0 ? 'text-purple-700 dark:text-purple-400' : 'text-muted-foreground'} />
          <span>Unsettled</span>
          {unsettledCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-xs font-bold bg-purple-600 text-white">
              {unsettledCount}
            </span>
          )}
        </button>
      )}

      {onShowOnlineOrders && (
        <button
          type="button"
          onClick={onShowOnlineOrders}
          className={`touch-target shrink-0 gap-1.5 rounded-lg border px-3 text-sm font-semibold transition-colors whitespace-nowrap flex items-center shadow-xs ${
            onlineOrdersCount > 0
              ? 'border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 hover:bg-amber-100'
              : 'border-border bg-card text-muted-foreground hover:bg-muted'
          }`}
          title="Incoming online customer orders"
          aria-label="Online Orders"
        >
          <Globe size={15} className={onlineOrdersCount > 0 ? 'text-amber-700 dark:text-amber-400' : 'text-muted-foreground'} />
          <span className="hidden sm:inline">Online Orders</span>
          {onlineOrdersCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-xs font-bold bg-amber-600 text-white animate-pulse">
              {onlineOrdersCount}
            </span>
          )}
        </button>
      )}

      <a
        href="/order"
        target="_blank"
        rel="noopener noreferrer"
        className="touch-target shrink-0 gap-1.5 rounded-lg border border-amber-300/80 bg-amber-50/80 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 px-3 text-sm font-semibold transition-colors hover:bg-amber-100 whitespace-nowrap flex items-center shadow-xs"
        title="Open Online Customer Ordering & Pickup Portal"
        aria-label="Open Online Customer Ordering & Pickup Portal"
      >
        <Globe size={16} className="text-amber-700 dark:text-amber-400" />
        <span className="hidden md:inline">Online Portal</span>
      </a>

      <div className="shrink-0">
        <PrinterStatus />
      </div>
      <button
        type="button"
        onClick={onToggleFullscreen}
        className="touch-target shrink-0 rounded-lg border border-border bg-card px-3 text-muted-foreground transition-colors hover:bg-muted active:bg-muted"
        title={fullscreen ? t('exitFullscreen') : t('enterFullscreen')}
        aria-label={fullscreen ? t('exitFullscreen') : t('enterFullscreen')}
      >
        {fullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
      </button>
    </div>
  );
}
