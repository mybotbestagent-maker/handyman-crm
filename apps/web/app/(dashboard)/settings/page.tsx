'use client';

import { Topbar } from '@/components/layout/topbar';
import { api } from '@/lib/trpc/client';
import { Building2, Shield, Users, Activity, AlertCircle } from 'lucide-react';
import Link from 'next/link';

const ACTION_LABELS: Record<string, { icon: string; color: string }> = {
  'customer.created':       { icon: '➕', color: 'text-green-700 bg-green-50' },
  'customer.updated':       { icon: '✏️', color: 'text-blue-700 bg-blue-50' },
  'job.created':            { icon: '➕', color: 'text-green-700 bg-green-50' },
  'job.status_changed':     { icon: '🔄', color: 'text-purple-700 bg-purple-50' },
  'job.assigned':           { icon: '👤', color: 'text-indigo-700 bg-indigo-50' },
  'job.items_updated':      { icon: '📝', color: 'text-blue-700 bg-blue-50' },
  'lead.created':           { icon: '🆕', color: 'text-cyan-700 bg-cyan-50' },
  'lead.status_changed':    { icon: '🔄', color: 'text-purple-700 bg-purple-50' },
  'user.role_changed':      { icon: '🛡️', color: 'text-amber-700 bg-amber-50' },
};

export default function SettingsPage() {
  const { data: me, isLoading: meLoading } = api.auth.me.useQuery();
  const { data: audit = [], isLoading: auditLoading, error: auditError } = api.auth.auditLog.useQuery({ limit: 50 });

  const isAdmin = me?.role === 'admin';

  return (
    <>
      <Topbar title="Settings" />

      <div className="px-4 md:px-10 py-8 md:py-10 max-w-[1200px] mx-auto space-y-8 mt-12 md:mt-0">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 border-b border-border pb-6">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground mb-3">
              Organization · {me?.role ?? '...'}
            </p>
            <h1 className="hero-headline !text-[34px] md:!text-[44px]">Settings.</h1>
            <p className="mt-3 text-[14px] text-muted-foreground">
              Org info, your role, and the activity audit trail.
            </p>
          </div>
        </div>

        {/* Org card + role card */}
        <div className="grid gap-5 md:grid-cols-2">
          <div className="card-premium p-7">
            <div className="flex items-center gap-2 mb-5">
              <Building2 className="h-[18px] w-[18px] text-muted-foreground/60" />
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Organization</h3>
            </div>
            <p className="text-[18px] font-bold tracking-tight">{me?.org?.name ?? '—'}</p>
            <p className="text-[13px] text-muted-foreground mt-1">{me?.org?.slug ?? '—'}</p>
          </div>
          <div className="card-premium p-7">
            <div className="flex items-center gap-2 mb-5">
              <Shield className="h-[18px] w-[18px] text-muted-foreground/60" />
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Your access</h3>
            </div>
            <p className="text-[18px] font-bold tracking-tight capitalize">{me?.fullName}</p>
            <p className="text-[13px] text-muted-foreground mt-1">
              <span className="capitalize">{me?.role}</span> · {me?.permissions?.length ?? 0} capabilities
            </p>
          </div>
        </div>

        {/* Activity log — admin only */}
        {isAdmin ? (
          <div className="card-premium overflow-hidden">
            <div className="flex items-center justify-between border-b border-border px-7 py-5">
              <div className="flex items-center gap-2">
                <Activity className="h-[18px] w-[18px] text-muted-foreground/60" />
                <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Activity Log
                </h3>
              </div>
              <p className="text-[12px] text-muted-foreground">
                Last {audit.length} entries · admin only
              </p>
            </div>

            {auditLoading ? (
              <div className="p-12 text-center text-[13px] text-muted-foreground">Loading...</div>
            ) : auditError ? (
              <div className="p-12 text-center text-[13px] text-destructive flex flex-col items-center gap-2">
                <AlertCircle className="h-5 w-5" />
                {auditError.message}
              </div>
            ) : audit.length === 0 ? (
              <div className="p-12 text-center text-[13px] text-muted-foreground">
                No activity recorded yet
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {audit.map((entry: any) => {
                  const meta = ACTION_LABELS[entry.action] ?? { icon: '•', color: 'text-gray-700 bg-gray-50' };
                  return (
                    <li key={entry.id} className="px-7 py-4 hover:bg-muted/30 transition-colors flex items-start gap-4">
                      <span className={`shrink-0 inline-flex h-9 w-9 items-center justify-center rounded-lg ${meta.color}`}>
                        {meta.icon}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline justify-between gap-3">
                          <p className="text-[13px] font-medium">
                            <span className="font-mono text-[12px] text-[hsl(var(--primary))]">{entry.action}</span>
                            <span className="text-muted-foreground ml-2">
                              {entry.entityType} · {entry.entityId.substring(0, 8)}
                            </span>
                          </p>
                          <p className="text-[11px] text-muted-foreground font-mono shrink-0">
                            {new Date(entry.createdAt).toLocaleString('en-US', {
                              month: 'short', day: 'numeric',
                              hour: 'numeric', minute: '2-digit', second: '2-digit',
                            })}
                          </p>
                        </div>
                        <p className="text-[12px] text-muted-foreground mt-0.5">
                          by <span className="font-medium">{entry.user?.fullName ?? entry.userId ?? 'system'}</span>
                          {entry.user?.role && (
                            <span className="ml-1 text-[10px] uppercase tracking-wider text-muted-foreground/70">
                              ({entry.user.role})
                            </span>
                          )}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        ) : (
          <div className="card-premium p-12 text-center text-muted-foreground">
            <Shield className="mx-auto h-10 w-10 mb-3 opacity-30" />
            <p className="text-[13px]">Activity Log is admin-only.</p>
            <Link href="/dashboard" className="text-[12px] text-[hsl(var(--primary))] hover:underline mt-2 inline-block">
              ← Back to dashboard
            </Link>
          </div>
        )}
      </div>
    </>
  );
}
