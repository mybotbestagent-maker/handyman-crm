'use client';

import { Topbar } from '@/components/layout/topbar';
import { api } from '@/lib/trpc/client';
import {
  Briefcase,
  PhoneIncoming,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Clock,
  CheckCircle,
  AlertTriangle,
  Users,
  Loader2,
  BarChart3,
  Zap,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { JobStatusBadge } from '@/components/shared/status-badges';
import Link from 'next/link';

// ── Stat Card ─────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  trend,
  href,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ComponentType<{ className?: string }>;
  iconBg?: string;
  iconColor?: string;
  trend?: { value: string; up: boolean };
  href?: string;
}) {
  const content = (
    <div className="card-premium p-7 transition-all hover:-translate-y-0.5">
      <div className="flex items-center justify-between mb-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          {label}
        </p>
        <Icon className="h-[18px] w-[18px] text-muted-foreground/60"  />
      </div>
      <p className="stat-display">{value}</p>
      {sub && <p className="mt-2 text-[13px] text-muted-foreground">{sub}</p>}
      {trend && (
        <div
          className={`mt-4 flex items-center gap-1.5 text-[12px] font-semibold ${
            trend.up ? 'text-green-600' : 'text-destructive'
          }`}
        >
          {trend.up ? (
            <TrendingUp className="h-3.5 w-3.5" />
          ) : (
            <TrendingDown className="h-3.5 w-3.5" />
          )}
          {trend.value} vs last month
        </div>
      )}
    </div>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }
  return content;
}

// ── Jobs by Status mini bar chart ─────────────────────────────────────────────

function StatusBar({
  label,
  count,
  total,
  color,
}: {
  label: string;
  count: number;
  total: number;
  color: string;
}) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="w-20 text-right text-xs text-muted-foreground truncate">{label}</span>
      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-8 text-right text-xs font-medium">{count}</span>
    </div>
  );
}

// ── Dashboard Page ─────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { data: stats, isLoading } = api.dashboard.stats.useQuery({});

  const jobsByStatus = stats?.jobsByStatus ?? {};
  const totalStatusJobs = Object.values(jobsByStatus).reduce(
    (sum: number, v: any) => sum + Number(v),
    0,
  );

  const activeJobs =
    (jobsByStatus['new'] ?? 0) +
    (jobsByStatus['scheduled'] ?? 0) +
    (jobsByStatus['dispatched'] ?? 0) +
    (jobsByStatus['en_route'] ?? 0) +
    (jobsByStatus['on_site'] ?? 0) +
    (jobsByStatus['in_progress'] ?? 0);

  const completedToday = jobsByStatus['completed'] ?? 0;

  return (
    <>
      <Topbar title="Dashboard" />

      <div className="px-10 py-12 max-w-[1400px] mx-auto space-y-10">
        {/* Hero header */}
        <div className="flex items-end justify-between border-b border-border pb-8">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground mb-3">
              Operations · Live
            </p>
            <h1 className="hero-headline">Today at Gold Hands.</h1>
            <p className="mt-3 text-[15px] text-muted-foreground max-w-md">
              Real-time view across every active job, technician and invoice — all 8 cities at once.
            </p>
          </div>
          <Link href="/jobs?new=1" className="btn-orange hidden md:inline-flex items-center gap-2 text-[14px]">
            New Job →
          </Link>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center p-20">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* Stats row */}
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                label="Jobs This Month"
                value={stats?.totalJobs ?? 0}
                sub="All cities combined"
                icon={Briefcase}
                href="/jobs"
              />
              <StatCard
                label="New Leads"
                value={stats?.newLeads ?? 0}
                sub="Awaiting response"
                icon={PhoneIncoming}
                iconBg="bg-blue-50"
                iconColor="text-blue-600"
                href="/leads"
              />
              <StatCard
                label="Outstanding Invoices"
                value={
                  stats?.openInvoices?.outstanding != null
                    ? formatCurrency(stats.openInvoices.outstanding)
                    : '—'
                }
                sub={
                  stats?.openInvoices?.count
                    ? `${stats.openInvoices.count} open invoice${stats.openInvoices.count !== 1 ? 's' : ''}`
                    : 'All clear'
                }
                icon={DollarSign}
                iconBg="bg-green-50"
                iconColor="text-green-600"
              />
              <StatCard
                label="Active Jobs"
                value={activeJobs}
                sub="In flight right now"
                icon={Zap}
                iconBg="bg-amber-50"
                iconColor="text-amber-600"
              />
            </div>

            {/* Status grid + chart row */}
            <div className="grid gap-4 lg:grid-cols-3">
              {/* Status grid */}
              <div className="lg:col-span-2 grid grid-cols-3 sm:grid-cols-3 gap-3">
                {[
                  { label: 'New', key: 'new', Icon: PhoneIncoming, color: 'text-blue-600', bg: 'bg-blue-50' },
                  { label: 'Scheduled', key: 'scheduled', Icon: Clock, color: 'text-purple-600', bg: 'bg-purple-50' },
                  { label: 'Dispatched', key: 'dispatched', Icon: Users, color: 'text-yellow-600', bg: 'bg-yellow-50' },
                  { label: 'On Site', key: 'on_site', Icon: AlertTriangle, color: 'text-orange-600', bg: 'bg-orange-50' },
                  { label: 'In Progress', key: 'in_progress', Icon: Briefcase, color: 'text-indigo-600', bg: 'bg-indigo-50' },
                  { label: 'Completed', key: 'completed', Icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50' },
                ].map((s) => (
                  <Link
                    key={s.key}
                    href={`/jobs`}
                    className="card-premium p-5 text-center transition-all hover:-translate-y-0.5"
                  >
                    <p className="stat-display !text-[32px]">{jobsByStatus[s.key] ?? 0}</p>
                    <p className="mt-1 text-[11px] uppercase tracking-[0.12em] text-muted-foreground">{s.label}</p>
                  </Link>
                ))}
              </div>

              {/* Status distribution chart */}
              <div className="card-premium p-7">
                <div className="flex items-center gap-2 mb-6">
                  <BarChart3 className="h-[18px] w-[18px] text-muted-foreground/60"  />
                  <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Jobs by Status</h3>
                </div>
                <div className="space-y-3">
                  {[
                    { label: 'In Progress', key: 'in_progress', color: 'bg-indigo-500' },
                    { label: 'Scheduled', key: 'scheduled', color: 'bg-purple-500' },
                    { label: 'Completed', key: 'completed', color: 'bg-green-500' },
                    { label: 'New', key: 'new', color: 'bg-blue-500' },
                    { label: 'Dispatched', key: 'dispatched', color: 'bg-yellow-500' },
                    { label: 'Paid', key: 'paid', color: 'bg-emerald-500' },
                    { label: 'Canceled', key: 'canceled', color: 'bg-red-400' },
                  ]
                    .filter((s) => (jobsByStatus[s.key] ?? 0) > 0)
                    .map((s) => (
                      <StatusBar
                        key={s.key}
                        label={s.label}
                        count={jobsByStatus[s.key] ?? 0}
                        total={totalStatusJobs}
                        color={s.color}
                      />
                    ))}
                </div>
                <p className="mt-4 text-xs text-muted-foreground border-t pt-3">
                  {totalStatusJobs} total jobs
                </p>
              </div>
            </div>

            {/* Recent jobs table */}
            <div className="card-premium overflow-hidden">
              <div className="flex items-center justify-between border-b border-border px-7 py-5">
                <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Recent Jobs</h2>
                <Link href="/jobs" className="text-[12px] font-medium text-[hsl(var(--primary))] hover:underline">
                  View all →
                </Link>
              </div>

              {stats?.recentJobs?.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground text-sm">
                  No jobs yet — create one to get started.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Job #</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Customer</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide hidden sm:table-cell">Technician</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide hidden md:table-cell">Scheduled</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {stats?.recentJobs?.map((job: any) => (
                        <tr
                          key={job.id}
                          className="hover:bg-muted/30 transition-colors"
                        >
                          <td className="px-6 py-4">
                            <Link
                              href={`/jobs`}
                              className="font-mono text-xs font-bold text-primary hover:underline"
                            >
                              {job.jobNumber}
                            </Link>
                          </td>
                          <td className="px-6 py-4 font-medium">
                            {job.customer?.billingName ?? '—'}
                          </td>
                          <td className="px-6 py-4 text-muted-foreground hidden sm:table-cell">
                            {job.technician?.user?.fullName ?? (
                              <span className="text-xs">Unassigned</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-muted-foreground font-mono text-xs hidden md:table-cell">
                            {job.scheduledStart
                              ? new Date(job.scheduledStart).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  hour: 'numeric',
                                  minute: '2-digit',
                                })
                              : '—'}
                          </td>
                          <td className="px-6 py-4">
                            <JobStatusBadge status={job.status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}
