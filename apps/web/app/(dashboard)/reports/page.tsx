import { Topbar } from '@/components/layout/topbar';
import { Metadata } from 'next';

export const metadata: Metadata = { title: 'Reports' };

export default function ReportsPage() {
  return (
    <>
      <Topbar title="Reports" />
      <div className="p-6">
        <div className="rounded-xl border bg-card p-12 text-center text-muted-foreground">
          <p className="text-lg font-medium">Reports — Phase 4 (Week 19)</p>
          <p className="mt-1 text-sm">Coming August 2026.</p>
        </div>
      </div>
    </>
  );
}
