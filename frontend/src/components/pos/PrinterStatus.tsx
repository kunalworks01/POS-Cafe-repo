'use client';

/** PrinterStatus: toolbar button showing connection state and exposing
 * connect/disconnect actions, print mode toggle, and test invoice print. */

import { useState } from 'react';
import {
  Printer,
  PrinterCheck,
  PrinterX,
  Loader2,
  Unplug,
  ChevronDown,
  Settings,
  FileText,
  Check,
  Zap,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { usePrinterStore } from '@/hooks/usePrinter';
import { useAuthStore } from '@/store/auth';
import type { PrinterStatus as PrinterStatusType } from '@/lib/printer/PrinterService';
import { createTestBill, createTestTenant } from '@/lib/printer/test-data';
import { showPrintWarningsToast } from '@/lib/printer/warnings-toast';
import toast from 'react-hot-toast';
import { useTranslations, type AppConfig } from 'use-intl';
import { Ltr } from '@/components/layout/Ltr';

type PosKey = keyof AppConfig['Messages']['pos'];

const STATUS_CONFIG: Record<
  PrinterStatusType,
  { labelKey: PosKey; color: string; Icon: React.ElementType }
> = {
  disconnected: {
    labelKey: 'printerNoPrinter',
    color: 'text-gray-400',
    Icon: Printer,
  },
  connecting: {
    labelKey: 'printerConnecting',
    color: 'text-amber-500',
    Icon: Loader2,
  },
  connected: {
    labelKey: 'printerReady',
    color: 'text-green-600',
    Icon: PrinterCheck,
  },
  error: {
    labelKey: 'printerError',
    color: 'text-red-500',
    Icon: PrinterX,
  },
};

export default function PrinterStatus() {
  const {
    status, deviceInfo, lastError,
    connect, disconnect, clearError,
    printMethod, setPrintMethod, hardwarePrinter, printBill,
  } = usePrinterStore();
  const { currentTenant } = useAuthStore();
  const t = useTranslations('pos');
  const router = useRouter();
  const [testing, setTesting] = useState(false);

  const effectiveStatus: PrinterStatusType = printMethod === 'browser'
    ? 'connected'
    : hardwarePrinter
      ? 'connected'
      : status;

  const cfg = STATUS_CONFIG[effectiveStatus];
  const Icon = cfg.Icon;

  const handleConnect = async () => {
    clearError();
    try {
      await connect();
      if (usePrinterStore.getState().status === 'connected') {
        toast.success(t('printerConnected'));
      } else if (usePrinterStore.getState().lastError) {
        toast.error(t('printerError'));
      }
    } catch {
      toast.error(t('printerError'));
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnect();
      toast(t('printerDisconnected'));
    } catch {
      toast.error(t('printerError'));
    }
  };

  const handleTestPrint = async () => {
    setTesting(true);
    try {
      const testBill = createTestBill();
      const tenant = currentTenant || createTestTenant({
        business_name: 'Hourglass Cafe',
        currency: 'INR',
        country: 'IN',
      });
      const warnings = await printBill(testBill, tenant);
      if (warnings && warnings.length > 0) {
        showPrintWarningsToast(warnings);
      }
      toast.success('Test invoice generated & sent to printer!');
    } catch (err: any) {
      console.error('[PrinterStatus] Test print failed:', err);
      toast.error(err?.message || 'Test print failed. Try System Print mode.');
    } finally {
      setTesting(false);
    }
  };

  const isConnected = !hardwarePrinter && status === 'connected';
  const isConnecting = status === 'connecting';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={`h-10 flex items-center gap-1.5 ${cfg.color} border-current/30 shadow-xs`}
        >
          <Icon
            size={16}
            className={isConnecting ? 'animate-spin' : undefined}
          />
          <span className="hidden sm:inline text-xs font-medium truncate max-w-[140px]">
            {printMethod === 'browser'
              ? 'System Print'
              : hardwarePrinter
                ? hardwarePrinter.name
                : t(cfg.labelKey)}
          </span>
          <ChevronDown size={12} className="text-gray-400" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56 p-1.5 space-y-1">
        <DropdownMenuLabel className="text-xs font-bold text-gray-700 dark:text-gray-200 px-2 py-1">
          Receipt Printer & Invoices
        </DropdownMenuLabel>

        {/* Print Method Switcher */}
        <div className="bg-muted/40 rounded-lg p-1 space-y-0.5">
          <div className="text-[11px] font-semibold text-muted-foreground px-1.5 py-0.5">
            Print Method:
          </div>
          <button
            type="button"
            onClick={() => {
              setPrintMethod('escpos');
              toast.success('Switched to Thermal ESC/POS mode');
            }}
            className={`w-full flex items-center justify-between px-2 py-1.5 rounded text-xs transition-colors ${
              printMethod === 'escpos'
                ? 'bg-card font-semibold text-foreground shadow-2xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <span className="flex items-center gap-1.5">
              <Zap size={13} className="text-amber-500" />
              Thermal (ESC/POS)
            </span>
            {printMethod === 'escpos' && <Check size={13} className="text-brand" />}
          </button>

          <button
            type="button"
            onClick={() => {
              setPrintMethod('browser');
              toast.success('Switched to System / Browser Print');
            }}
            className={`w-full flex items-center justify-between px-2 py-1.5 rounded text-xs transition-colors ${
              printMethod === 'browser'
                ? 'bg-card font-semibold text-foreground shadow-2xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <span className="flex items-center gap-1.5">
              <Printer size={13} className="text-blue-500" />
              System / Browser Print
            </span>
            {printMethod === 'browser' && <Check size={13} className="text-brand" />}
          </button>
        </div>

        {/* Hardware Status details */}
        {hardwarePrinter && (
          <div className="px-2 py-1.5 text-xs text-gray-500 border border-border/50 rounded-md bg-muted/20">
            <p className="font-medium text-gray-700 dark:text-gray-300 truncate flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
              {hardwarePrinter.name}
            </p>
            <p className="capitalize text-[11px]">
              {hardwarePrinter.connection_type}
              {hardwarePrinter.connection_type === 'network' && hardwarePrinter.ip_address
                ? <> · <Ltr>{hardwarePrinter.ip_address}{hardwarePrinter.port ? ':' + hardwarePrinter.port : ''}</Ltr></>
                : ''}
              {hardwarePrinter.paper_width ? ` · ${hardwarePrinter.paper_width}` : ''}
            </p>
          </div>
        )}

        {isConnected && deviceInfo && (
          <div className="px-2 py-1.5 text-xs text-gray-500 border border-border/50 rounded-md bg-muted/20">
            <p className="font-medium text-gray-700 dark:text-gray-300 truncate flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
              {deviceInfo.productName ?? t('printerUnknownDevice')}
            </p>
            <p className="text-[11px]"><Ltr>{deviceInfo.manufacturerName ?? `VID:${deviceInfo.vendorId.toString(16).toUpperCase()}`}</Ltr></p>
          </div>
        )}

        {lastError && (
          <div className="px-2 py-1.5 text-xs text-red-600 bg-red-50 dark:bg-red-950/40 rounded border border-red-200">
            {t('printerError')}
          </div>
        )}

        <DropdownMenuSeparator />

        {/* USB Actions */}
        {printMethod === 'escpos' && !hardwarePrinter && (
          <>
            {!isConnected && !isConnecting && (
              <DropdownMenuItem
                onClick={handleConnect}
                disabled={isConnecting}
                className="text-xs cursor-pointer font-medium"
              >
                <Printer size={14} className="me-2 text-brand" />
                {t('printerConnectUsb')}
              </DropdownMenuItem>
            )}

            {isConnected && (
              <DropdownMenuItem
                onClick={handleDisconnect}
                className="text-xs cursor-pointer text-red-600 focus:text-red-600"
              >
                <Unplug size={14} className="me-2" />
                {t('printerDisconnect')}
              </DropdownMenuItem>
            )}
          </>
        )}

        {/* Test Print Action */}
        <DropdownMenuItem
          onClick={handleTestPrint}
          disabled={testing}
          className="text-xs cursor-pointer font-medium text-purple-700 dark:text-purple-300 focus:text-purple-800"
        >
          <FileText size={14} className="me-2" />
          {testing ? 'Printing Test...' : 'Test Print Invoice'}
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onClick={() => router.push('/settings?tab=receipts-printers')}
          className="text-xs cursor-pointer"
        >
          <Settings size={14} className="me-2" />
          {t('printerSettings')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
