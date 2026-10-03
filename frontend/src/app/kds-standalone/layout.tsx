import type { Metadata } from 'next';
import '../globals.css';
import { KdsHtmlLang } from '@/components/kds/KdsHtmlLang';

export const metadata: Metadata = {
  title: 'Pro-Cafe KDS - Kitchen Display System',
  description: 'Kitchen Display System for Pro-Cafe',
};

export default function KdsStandaloneLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen h-full flex flex-col p-4 bg-muted">
      <KdsHtmlLang />
      {children}
    </div>
  );
}
