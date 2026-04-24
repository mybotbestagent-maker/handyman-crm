import { Topbar } from '@/components/layout/topbar';
import { Metadata } from 'next';

export const metadata: Metadata = { title: 'Invoices' };

export default function InvoicesPage() {
  return (
    <>
      <Topbar title="Invoices" />
      <div className="p-6">
        <div className="rounded-xl border bg-card p-12 text-center text-muted-foreground">
          <p className="text-lg font-medium">Invoices — Phase 1 (Week 6)</p>
          <p className="mt-1 text-sm">Coming June 1, 2026.</p>
        </div>
      </div>
    </>
  );
}
