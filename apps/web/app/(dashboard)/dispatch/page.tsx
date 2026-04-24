import { Topbar } from '@/components/layout/topbar';
import { Metadata } from 'next';

export const metadata: Metadata = { title: 'Dispatch Board' };

export default function DispatchPage() {
  return (
    <>
      <Topbar title="Dispatch Board" />
      <div className="p-6">
        <div className="rounded-xl border bg-card p-12 text-center text-muted-foreground">
          <p className="text-lg font-medium">Dispatch Board — Phase 1 (Week 5)</p>
          <p className="mt-1 text-sm">Coming May 19, 2026. Real-time drag-and-drop board.</p>
        </div>
      </div>
    </>
  );
}
