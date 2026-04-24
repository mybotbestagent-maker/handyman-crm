import { Topbar } from '@/components/layout/topbar';
import { Metadata } from 'next';

export const metadata: Metadata = { title: 'Schedule' };

export default function SchedulePage() {
  return (
    <>
      <Topbar title="Schedule" />
      <div className="p-6">
        <div className="rounded-xl border bg-card p-12 text-center text-muted-foreground">
          <p className="text-lg font-medium">Schedule — Phase 1 (Week 5)</p>
          <p className="mt-1 text-sm">Coming May 19, 2026. Day/week/month calendar.</p>
        </div>
      </div>
    </>
  );
}
