import { Topbar } from '@/components/layout/topbar';
import { Metadata } from 'next';

export const metadata: Metadata = { title: 'Settings' };

export default function SettingsPage() {
  return (
    <>
      <Topbar title="Settings" />
      <div className="p-6 space-y-6">
        <div className="rounded-xl border bg-card p-6">
          <h2 className="font-semibold">Organization</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Handyman Gold Hands — Miami, FL
          </p>
        </div>
        <div className="rounded-xl border bg-card p-12 text-center text-muted-foreground">
          <p className="text-sm">Full settings coming in Phase 0 completion.</p>
        </div>
      </div>
    </>
  );
}
