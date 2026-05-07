'use client';

/**
 * Jobs page — T-CORE-OPPORTUNITY Step 5 UI cutover.
 *
 * Reads from opportunityRouter instead of jobRouter.
 * Shows opportunities in job stages: job_created | scheduled | on_the_way |
 * in_progress | done | invoiced | paid.
 *
 * The old jobRouter remains registered and functional. CreateJobForm still
 * calls job.create until the full write-side cutover (Step 6 scope).
 *
 * Detail view uses opportunity.byId for rich financials.
 */

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Topbar } from '@/components/layout/topbar';
import { api } from '@/lib/trpc/client';
import {
  Plus,
  ArrowLeft,
  Loader2,
  X,
  MapPin,
  Calendar,
  DollarSign,
  Clock,
  Star,
  Wrench,
  ChevronRight,
  AlertTriangle,
  Briefcase,
  Zap,
  TrendingUp,
  TrendingDown,
  Phone,
  Timer,
  Receipt,
} from 'lucide-react';
import { formatCurrency, formatDate, formatPhone } from '@/lib/utils';
import { OppStageBadge, PriorityBadge } from '@/components/shared/status-badges';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// Stages shown on this (jobs) page
const JOB_STAGES = [
  'job_created',
  'scheduled',
  'on_the_way',
  'in_progress',
  'done',
  'invoiced',
  'paid',
] as const;

type JobStageFilter = (typeof JOB_STAGES)[number] | 'all';

const STAGE_TABS: { label: string; value: JobStageFilter }[] = [
  { label: 'All', value: 'all' },
  { label: 'New', value: 'job_created' },
  { label: 'Scheduled', value: 'scheduled' },
  { label: 'On the Way', value: 'on_the_way' },
  { label: 'In Progress', value: 'in_progress' },
  { label: 'Done', value: 'done' },
  { label: 'Invoiced', value: 'invoiced' },
];

// Which stage transitions are available per stage (subset of STAGE_TRANSITIONS from opportunity-stages.ts)
const STAGE_NEXT: Record<string, string[]> = {
  job_created:  ['scheduled', 'lost'],
  scheduled:    ['on_the_way', 'in_progress', 'lost'],
  on_the_way:   ['in_progress', 'lost'],
  in_progress:  ['done', 'lost'],
  done:         ['invoiced', 'lost'],
  invoiced:     ['paid', 'lost'],
  paid:         [],
};

const STAGE_BUTTON_LABELS: Record<string, string> = {
  scheduled:  'Mark Scheduled',
  on_the_way: 'Tech En Route',
  in_progress:'Start Work',
  done:       'Mark Done',
  invoiced:   'Invoice Sent',
  paid:       'Mark Paid',
  lost:       'Cancel',
};

const CATEGORIES = ['general', 'plumbing', 'electrical', 'carpentry', 'painting', 'hvac'];

// ── Schedule column ──────────────────────────────────────────────────────────

function ScheduleColumn({
  label,
  icon: Icon,
  opps,
  onSelect,
  highlight,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  opps: any[];
  onSelect: (id: string) => void;
  highlight?: boolean;
}) {
  return (
    <div className={`card-premium overflow-hidden ${highlight ? 'border-[hsl(var(--primary))]/30' : ''}`}>
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <div className="flex items-center gap-2">
          <Icon className={`h-[16px] w-[16px] ${highlight ? 'text-[hsl(var(--primary))]' : 'text-muted-foreground/60'}`} />
          <h3 className="text-[12px] font-bold uppercase tracking-[0.1em]">{label}</h3>
        </div>
        <span className="text-[11px] font-semibold text-muted-foreground">{opps.length}</span>
      </div>
      {opps.length === 0 ? (
        <div className="p-8 text-center text-[12px] text-muted-foreground">
          Nothing scheduled
        </div>
      ) : (
        <div className="divide-y divide-border max-h-[300px] overflow-y-auto">
          {opps.slice(0, 6).map((opp: any) => {
            const t = opp.scheduledStart
              ? new Date(opp.scheduledStart).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
              : '—';
            return (
              <button
                key={opp.id}
                onClick={() => onSelect(opp.id)}
                className="w-full text-left px-5 py-3 hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center justify-between gap-2 mb-0.5">
                  <OppStageBadge stage={opp.stage} />
                  <span className="text-[11px] text-muted-foreground font-mono">{t}</span>
                </div>
                <p className="text-[13px] font-medium truncate">{opp.customerName}</p>
                <p className="text-[11px] text-muted-foreground capitalize truncate">
                  {opp.serviceCategory} · {opp.technician?.user?.fullName ?? 'Unassigned'}
                </p>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Opportunity Detail ───────────────────────────────────────────────────────

function OppDetail({ oppId, onBack }: { oppId: string; onBack: () => void }) {
  const utils = api.useUtils();
  const { data: opp, isLoading } = api.opportunity.byId.useQuery({ id: oppId });

  const transitionStage = api.opportunity.transitionStage.useMutation({
    onSuccess: () => {
      utils.opportunity.byId.invalidate({ id: oppId });
      utils.opportunity.list.invalidate();
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!opp) return null;

  const transitions = STAGE_NEXT[opp.stage] ?? [];
  const smart = (opp as any).smart ?? {};
  const address = opp.property
    ? `${opp.property.addressLine1}, ${opp.property.city}, ${opp.property.state}`
    : opp.addressLine
    ? `${opp.addressLine}, ${opp.city ?? ''}, ${opp.state ?? ''}`
    : '—';

  const profitColor =
    smart.profit > 0 ? 'text-green-600' : smart.profit < 0 ? 'text-red-600' : 'text-muted-foreground';

  return (
    <div className="px-4 md:px-10 py-8 md:py-10 max-w-[1400px] mx-auto space-y-8 mt-12 md:mt-0">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to jobs
      </button>

      {/* Hero header */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 border-b border-border pb-6 md:pb-8">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground mb-3 flex items-center gap-2 flex-wrap">
            <span className="capitalize">{opp.serviceCategory}</span>
            <span>·</span>
            <span className="capitalize">via {opp.sourceId?.replace(/_/g, ' ') ?? 'unknown'}</span>
            <OppStageBadge stage={opp.stage} />
            <PriorityBadge priority={opp.priority} />
          </p>
          <h1 className="hero-headline !text-[34px] md:!text-[44px] leading-[1.1]">
            {opp.description ?? opp.serviceCategory}
          </h1>
        </div>

        {transitions.length > 0 && (
          <div className="flex flex-wrap gap-2 self-start md:self-auto">
            {transitions.map((nextStage) => {
              const isLost = nextStage === 'lost';
              const isPrimary = ['scheduled', 'in_progress', 'done', 'paid'].includes(nextStage);
              return (
                <Button
                  key={nextStage}
                  size="sm"
                  variant={isLost ? 'destructive' : isPrimary ? 'default' : 'outline'}
                  className={isPrimary && !isLost ? 'btn-orange !py-2 !px-4 !text-[13px]' : ''}
                  disabled={transitionStage.isPending}
                  onClick={() =>
                    transitionStage.mutate({
                      id: opp.id,
                      toStage: nextStage as any,
                      ...(nextStage === 'lost' && { lostReason: 'canceled' }),
                    })
                  }
                >
                  {transitionStage.isPending && (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  )}
                  {STAGE_BUTTON_LABELS[nextStage] ?? nextStage.replace(/_/g, ' ')}
                </Button>
              );
            })}
          </div>
        )}
      </div>

      {/* Smart stat cards */}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card-premium p-7">
          <div className="flex items-center justify-between mb-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Revenue</p>
            <DollarSign className="h-[18px] w-[18px] text-muted-foreground/60" />
          </div>
          <p className="stat-display text-[hsl(var(--primary))]">
            {smart.revenue > 0 ? formatCurrency(smart.revenue) : '—'}
          </p>
          <p className="mt-2 text-[13px] text-muted-foreground">
            {opp.finalAmount ? 'Actual' : opp.estimateAmount ? 'Estimated' : 'Not set'}
          </p>
        </div>

        <div className="card-premium p-7">
          <div className="flex items-center justify-between mb-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Profit</p>
            {smart.profit > 0 ? (
              <TrendingUp className="h-[18px] w-[18px] text-green-600" />
            ) : smart.profit < 0 ? (
              <TrendingDown className="h-[18px] w-[18px] text-red-600" />
            ) : (
              <DollarSign className="h-[18px] w-[18px] text-muted-foreground/60" />
            )}
          </div>
          <p className={`stat-display ${profitColor}`}>
            {smart.revenue > 0 ? formatCurrency(smart.profit) : '—'}
          </p>
          <p className="mt-2 text-[13px] text-muted-foreground">
            {smart.revenue > 0
              ? `Margin ${(smart.margin * 100).toFixed(0)}% · Labor ${formatCurrency(smart.labor)}`
              : 'Add line items'}
          </p>
        </div>

        <div className="card-premium p-7">
          <div className="flex items-center justify-between mb-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Time on Site</p>
            <Timer className="h-[18px] w-[18px] text-muted-foreground/60" />
          </div>
          <p className="stat-display">
            {smart.timeOnSiteMinutes != null
              ? `${Math.floor(smart.timeOnSiteMinutes / 60)}h ${smart.timeOnSiteMinutes % 60}m`
              : '—'}
          </p>
          <p className="mt-2 text-[13px] text-muted-foreground">
            {opp.actualStart ? `Started ${formatDate(opp.actualStart)}` : 'Not started'}
          </p>
        </div>

        <div className="card-premium p-7">
          <div className="flex items-center justify-between mb-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Schedule</p>
            <Clock className="h-[18px] w-[18px] text-muted-foreground/60" />
          </div>
          <p className="stat-display">
            {opp.scheduledStart ? (
              new Date(opp.scheduledStart).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
            ) : '—'}
          </p>
          <p className="mt-2 text-[13px] text-muted-foreground">
            {opp.scheduledStart
              ? new Date(opp.scheduledStart).toLocaleTimeString('en-US', {
                  hour: 'numeric',
                  minute: '2-digit',
                })
              : 'Not scheduled'}
          </p>
        </div>
      </div>

      {/* Customer + Tech + Address */}
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="card-premium p-7">
          <div className="flex items-center gap-2 mb-5">
            <Briefcase className="h-[18px] w-[18px] text-muted-foreground/60" />
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Customer</h3>
          </div>
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-[hsl(var(--primary))] flex items-center justify-center text-white font-bold">
              {opp.customerName?.charAt(0) ?? '?'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-[15px] truncate">{opp.customerName}</p>
              {opp.customerPhone && (
                <a
                  href={`tel:${opp.customerPhone}`}
                  className="text-[12px] text-muted-foreground hover:text-[hsl(var(--primary))] flex items-center gap-1"
                >
                  <Phone className="h-3 w-3" />
                  {formatPhone(opp.customerPhone)}
                </a>
              )}
            </div>
          </div>
        </div>

        <div className="card-premium p-7">
          <div className="flex items-center gap-2 mb-5">
            <Wrench className="h-[18px] w-[18px] text-muted-foreground/60" />
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Technician</h3>
          </div>
          {opp.technician ? (
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-xl bg-amber-500 flex items-center justify-center text-white font-bold">
                {opp.technician.user?.fullName?.charAt(0) ?? 'T'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-[15px] truncate">{opp.technician.user?.fullName}</p>
                {opp.technician.rating && (
                  <p className="text-[12px] text-muted-foreground flex items-center gap-1">
                    <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                    {Number(opp.technician.rating).toFixed(1)}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-muted-foreground">
              <span className="text-[14px]">Unassigned</span>
            </div>
          )}
        </div>

        <div className="card-premium p-7">
          <div className="flex items-center gap-2 mb-5">
            <MapPin className="h-[18px] w-[18px] text-muted-foreground/60" />
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Service Address</h3>
          </div>
          <p className="text-[14px] leading-snug">{address}</p>
          {opp.property?.accessNotes && (
            <p className="mt-2 text-[11px] text-amber-700 bg-amber-50 px-2 py-1 rounded">
              Access: {opp.property.accessNotes}
            </p>
          )}
        </div>
      </div>

      {/* Line items */}
      {opp.items && opp.items.length > 0 && (
        <div className="card-premium overflow-hidden">
          <div className="flex items-center justify-between border-b border-border px-7 py-5">
            <div className="flex items-center gap-2">
              <Receipt className="h-[18px] w-[18px] text-muted-foreground/60" />
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Line Items ({opp.items.length})
              </h3>
            </div>
            <p className="text-[14px] font-bold text-[hsl(var(--primary))]">
              {formatCurrency(smart.revenue)}
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="px-6 py-3 text-left text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Item</th>
                  <th className="px-4 py-3 text-right text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Qty</th>
                  <th className="px-4 py-3 text-right text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Unit</th>
                  <th className="px-6 py-3 text-right text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {opp.items.map((item: any) => (
                  <tr key={item.id} className={item.itemType === 'discount' ? 'text-green-700' : ''}>
                    <td className="px-6 py-3">
                      <p className="font-medium">{item.name}</p>
                      <p className="text-[11px] text-muted-foreground capitalize">{item.itemType}</p>
                    </td>
                    <td className="px-4 py-3 text-right">{Number(item.qty)}</td>
                    <td className="px-4 py-3 text-right">{formatCurrency(Number(item.unitPrice))}</td>
                    <td className="px-6 py-3 text-right font-semibold">
                      {Number(item.total) < 0
                        ? `(${formatCurrency(Math.abs(Number(item.total)))})`
                        : formatCurrency(Number(item.total))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Notes & rating */}
      <div className="grid gap-5 md:grid-cols-2">
        {opp.internalNotes && (
          <div className="card-premium p-7">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground mb-3">Internal Notes</h3>
            <p className="text-[14px] text-foreground/80 whitespace-pre-wrap leading-relaxed">{opp.internalNotes}</p>
          </div>
        )}
        {opp.customerRating && (
          <div className="card-premium p-7">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground mb-3">Customer Rating</h3>
            <div className="flex items-center gap-1 mb-2">
              {[1, 2, 3, 4, 5].map((s) => (
                <Star
                  key={s}
                  className={`h-5 w-5 ${
                    opp.customerRating != null && s <= opp.customerRating
                      ? 'fill-amber-400 text-amber-400'
                      : 'text-muted fill-muted'
                  }`}
                />
              ))}
              <span className="ml-2 text-[14px] font-semibold">{opp.customerRating}/5</span>
            </div>
            {opp.customerReview && (
              <p className="text-[13px] text-muted-foreground">{opp.customerReview}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Create Job Form (still creates via job.create — write-side cutover in Step 6) ──

function CreateJobForm({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: (id: string) => void;
}) {
  const utils = api.useUtils();
  const { data: custData } = api.customer.list.useQuery({ limit: 100 });
  const customers = custData?.items ?? [];

  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [form, setForm] = useState({
    customerId: '',
    propertyId: '',
    jobType: 'repair',
    category: 'general',
    description: '',
    priority: 'normal',
    estimatedRevenue: '',
    durationEstimateMinutes: '',
    internalNotes: '',
  });

  const createMutation = api.job.create.useMutation({
    onSuccess: (data) => {
      utils.opportunity.list.invalidate();
      onSaved(data.id);
    },
  });

  const set =
    (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((p) => ({ ...p, [k]: e.target.value }));

  function handleCustomerChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const id = e.target.value;
    const cust = customers.find((c: any) => c.id === id);
    setSelectedCustomer(cust ?? null);
    setForm((p) => ({
      ...p,
      customerId: id,
      propertyId: cust?.properties?.[0]?.id ?? '',
    }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    createMutation.mutate({
      customerId: form.customerId,
      propertyId: form.propertyId,
      jobType: form.jobType as any,
      category: form.category,
      description: form.description,
      priority: form.priority as any,
      estimatedRevenue: form.estimatedRevenue ? Number(form.estimatedRevenue) : undefined,
      durationEstimateMinutes: form.durationEstimateMinutes
        ? Number(form.durationEstimateMinutes)
        : undefined,
      internalNotes: form.internalNotes || undefined,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-xl bg-background border shadow-xl overflow-y-auto max-h-[90vh]">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h2 className="text-[17px] font-bold tracking-tight">New Job</h2>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-accent transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="space-y-1.5">
            <Label>Customer *</Label>
            <select
              value={form.customerId}
              onChange={handleCustomerChange}
              required
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">— Select customer —</option>
              {customers.map((c: any) => (
                <option key={c.id} value={c.id}>
                  {c.billingName}
                </option>
              ))}
            </select>
          </div>

          {selectedCustomer?.properties?.length > 0 && (
            <div className="space-y-1.5">
              <Label>Property *</Label>
              <select
                value={form.propertyId}
                onChange={set('propertyId')}
                required
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {selectedCustomer.properties.map((p: any) => (
                  <option key={p.id} value={p.id}>
                    {p.addressLine1}, {p.city} {p.state}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Job Type *</Label>
              <select
                value={form.jobType}
                onChange={set('jobType')}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="repair">Repair</option>
                <option value="install">Install</option>
                <option value="maintenance">Maintenance</option>
                <option value="inspection">Inspection</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Category *</Label>
              <select
                value={form.category}
                onChange={set('category')}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c} className="capitalize">
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Description *</Label>
            <textarea
              value={form.description}
              onChange={set('description')}
              required
              rows={3}
              placeholder="Describe the work to be done..."
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Priority</Label>
              <select
                value={form.priority}
                onChange={set('priority')}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="emergency">Emergency</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Est. Revenue $</Label>
              <Input
                type="number"
                value={form.estimatedRevenue}
                onChange={set('estimatedRevenue')}
                placeholder="350"
                min="0"
                step="0.01"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Duration (min)</Label>
              <Input
                type="number"
                value={form.durationEstimateMinutes}
                onChange={set('durationEstimateMinutes')}
                placeholder="90"
                min="0"
                step="15"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Internal Notes</Label>
            <textarea
              value={form.internalNotes}
              onChange={set('internalNotes')}
              rows={2}
              placeholder="Notes for the team..."
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
            />
          </div>

          {createMutation.error && (
            <p className="text-sm text-destructive">{createMutation.error.message}</p>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createMutation.isPending || !form.customerId || !form.propertyId}
              className="btn-orange !text-[13px]"
            >
              {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Job
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main Jobs Page ─────────────────────────────────────────────────────────────

export default function JobsPage() {
  return (
    <Suspense
      fallback={
        <>
          <Topbar title="Jobs" />
          <div className="p-12 flex justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        </>
      }
    >
      <JobsPageInner />
    </Suspense>
  );
}

function JobsPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlId = searchParams.get('id');

  const [activeStage, setActiveStage] = useState<JobStageFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [unassignedOnly, setUnassignedOnly] = useState<boolean>(false);
  const [selectedOppId, setSelectedOppId] = useState<string | null>(urlId);
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    setSelectedOppId(urlId);
  }, [urlId]);

  function selectOpp(id: string | null) {
    if (id) router.push(`/jobs?id=${id}`);
    else router.push('/jobs');
    setSelectedOppId(id);
  }

  // All job-stage opps for counts + unassigned banner
  const { data: allData } = api.opportunity.list.useQuery({
    stages: [...JOB_STAGES],
    limit: 100,
  });
  const allOpps = allData?.items ?? [];

  // Filtered list
  const { data: listData, isLoading } = api.opportunity.list.useQuery({
    stages: activeStage === 'all' ? [...JOB_STAGES] : [activeStage],
    unassignedOnly: unassignedOnly || undefined,
    limit: 100,
  });
  const opps = listData?.items ?? [];

  // Count per stage for tabs
  const countByStage = allOpps.reduce((acc: Record<string, number>, o: any) => {
    acc[o.stage] = (acc[o.stage] ?? 0) + 1;
    return acc;
  }, {});

  // Unassigned jobs (job_created with no technician)
  const unassignedOpps = allOpps.filter(
    (o: any) => !o.technicianId && ['job_created', 'scheduled'].includes(o.stage),
  );

  // Today / tomorrow schedule columns
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  const todayOpps = allOpps.filter((o: any) => {
    if (!o.scheduledStart) return false;
    const d = new Date(o.scheduledStart);
    return d.toDateString() === today.toDateString();
  });
  const tomorrowOpps = allOpps.filter((o: any) => {
    if (!o.scheduledStart) return false;
    const d = new Date(o.scheduledStart);
    return d.toDateString() === tomorrow.toDateString();
  });

  const inProgressCount =
    (countByStage['in_progress'] ?? 0) +
    (countByStage['on_the_way'] ?? 0);

  // Apply category filter client-side (opportunity doesn't have a category field in the same way)
  const filteredOpps = categoryFilter
    ? opps.filter((o: any) =>
        (o.serviceCategory ?? '').toLowerCase() === categoryFilter.toLowerCase(),
      )
    : opps;

  if (selectedOppId) {
    return (
      <>
        <Topbar title="Jobs" />
        <OppDetail oppId={selectedOppId} onBack={() => selectOpp(null)} />
        {showCreate && (
          <CreateJobForm
            onClose={() => setShowCreate(false)}
            onSaved={(id) => {
              setShowCreate(false);
              selectOpp(id);
            }}
          />
        )}
      </>
    );
  }

  return (
    <>
      <Topbar title="Jobs" />

      <div className="px-4 md:px-10 py-8 md:py-12 max-w-[1500px] mx-auto space-y-8 mt-12 md:mt-0">
        {/* Hero header */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 border-b border-border pb-6 md:pb-8">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground mb-3">
              Operations · Active jobs
            </p>
            <h1 className="hero-headline">Jobs.</h1>
            <p className="mt-3 text-[14px] text-muted-foreground max-w-md">
              Every active job, scheduled, dispatched, and completed across the team.
            </p>
          </div>
          <Button
            onClick={() => setShowCreate(true)}
            className="btn-orange inline-flex items-center justify-center gap-2 text-[14px] self-start md:self-auto"
          >
            <Plus className="h-4 w-4" />
            New Job
          </Button>
        </div>

        {/* Unassigned banner */}
        {unassignedOpps.length > 0 && (
          <div className="card-premium border-amber-300 bg-amber-50/30 overflow-hidden">
            <div className="flex items-center justify-between border-b border-amber-200/60 bg-amber-50/60 px-7 py-5">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
                <div>
                  <h3 className="text-[15px] font-bold text-amber-900">
                    {unassignedOpps.length} job{unassignedOpps.length !== 1 ? 's' : ''} need
                    {unassignedOpps.length === 1 ? 's' : ''} a technician
                  </h3>
                  <p className="text-[12px] text-amber-700">Assign now to keep the schedule moving</p>
                </div>
              </div>
              <button
                onClick={() => setUnassignedOnly(true)}
                className="text-[12px] text-amber-800 font-semibold hover:underline"
              >
                View all →
              </button>
            </div>
            <div className="grid gap-3 p-5 md:grid-cols-2 lg:grid-cols-3">
              {unassignedOpps.slice(0, 6).map((opp: any) => (
                <button
                  key={opp.id}
                  onClick={() => selectOpp(opp.id)}
                  className="text-left rounded-lg border border-amber-200 bg-white p-4 hover:border-amber-400 hover:shadow-sm transition-all"
                >
                  <div className="flex items-start justify-between mb-2">
                    <OppStageBadge stage={opp.stage} />
                    <PriorityBadge priority={opp.priority} />
                  </div>
                  <p className="font-semibold text-[14px] truncate">{opp.customerName}</p>
                  <p className="text-[12px] text-muted-foreground line-clamp-2 mt-1">{opp.description}</p>
                  <div className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    <span>
                      {opp.city ?? '—'}, {opp.state ?? ''}
                    </span>
                    <span className="ml-auto capitalize">{opp.serviceCategory}</span>
                  </div>
                  <div className="mt-3 pt-3 border-t border-dashed border-amber-200 flex items-center gap-2">
                    <Zap className="h-3 w-3 text-amber-500" />
                    <span className="text-[10px] uppercase tracking-wide font-semibold text-amber-700">
                      Suggested tech
                    </span>
                    <span className="text-[11px] text-muted-foreground italic ml-auto">Midas — coming</span>
                  </div>
                  <Button
                    size="sm"
                    className="btn-orange w-full mt-3 !text-[12px] !py-1.5"
                    onClick={(e) => {
                      e.stopPropagation();
                      selectOpp(opp.id);
                    }}
                  >
                    Claim & assign →
                  </Button>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Schedule overview */}
        <div className="grid gap-5 lg:grid-cols-3">
          <ScheduleColumn
            label="Today"
            icon={Calendar}
            opps={todayOpps}
            onSelect={selectOpp}
            highlight
          />
          <ScheduleColumn
            label="Tomorrow"
            icon={Calendar}
            opps={tomorrowOpps}
            onSelect={selectOpp}
          />

          <div className="space-y-5">
            <div className="card-premium p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground flex items-center gap-2">
                  <Zap className="h-[14px] w-[14px]" /> Live in field
                </p>
              </div>
              <p className="stat-display !text-[36px]">{inProgressCount}</p>
              <p className="mt-1 text-[12px] text-muted-foreground">on the way · in progress</p>
            </div>
            <div className="card-premium p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground flex items-center gap-2">
                  <DollarSign className="h-[14px] w-[14px]" /> Active jobs
                </p>
              </div>
              <p className="stat-display !text-[36px] text-[hsl(var(--primary))]">
                {allOpps.length}
              </p>
              <p className="mt-1 text-[12px] text-muted-foreground">across all job stages</p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-none flex-1">
            {STAGE_TABS.map((tab) => {
              const count = tab.value === 'all' ? allOpps.length : countByStage[tab.value] ?? 0;
              const isActive = tab.value === activeStage;
              return (
                <button
                  key={tab.value}
                  onClick={() => {
                    setActiveStage(tab.value);
                    setUnassignedOnly(false);
                  }}
                  className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-[12px] font-medium whitespace-nowrap transition-colors border ${
                    isActive
                      ? 'bg-foreground text-background border-foreground'
                      : 'border-border hover:bg-secondary text-muted-foreground'
                  }`}
                >
                  {tab.label}
                  {count > 0 && (
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                        isActive ? 'bg-white/20 text-white' : 'bg-muted'
                      }`}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="h-9 rounded-full border border-border bg-background px-4 text-[12px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring capitalize"
            >
              <option value="">All categories</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c} className="capitalize">
                  {c}
                </option>
              ))}
            </select>

            {unassignedOnly && (
              <button
                onClick={() => setUnassignedOnly(false)}
                className="h-9 px-3 rounded-full border border-amber-300 bg-amber-50 text-amber-800 text-[12px] font-medium flex items-center gap-1.5"
              >
                Unassigned only
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>

        {/* Opps table */}
        <div className="card-premium overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center p-16">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : filteredOpps.length === 0 ? (
            <div className="p-16 text-center text-muted-foreground">
              <Wrench className="mx-auto h-10 w-10 mb-3 opacity-30" />
              <p className="font-medium">
                {activeStage === 'all' && !categoryFilter && !unassignedOnly
                  ? 'No jobs yet'
                  : 'No jobs match these filters'}
              </p>
              <Button
                onClick={() => setShowCreate(true)}
                size="sm"
                className="mt-4 btn-orange !text-[13px]"
              >
                <Plus className="h-4 w-4 mr-1.5" />
                Create Job
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="px-6 py-3 text-left text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Customer</th>
                    <th className="px-6 py-3 text-left text-[11px] font-medium text-muted-foreground uppercase tracking-wide hidden sm:table-cell">Category</th>
                    <th className="px-6 py-3 text-left text-[11px] font-medium text-muted-foreground uppercase tracking-wide hidden md:table-cell">Tech</th>
                    <th className="px-6 py-3 text-left text-[11px] font-medium text-muted-foreground uppercase tracking-wide hidden lg:table-cell">Scheduled</th>
                    <th className="px-6 py-3 text-right text-[11px] font-medium text-muted-foreground uppercase tracking-wide hidden lg:table-cell">Revenue</th>
                    <th className="px-6 py-3 text-left text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Stage</th>
                    <th className="px-4 py-3 w-8" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredOpps.map((opp: any) => (
                    <tr
                      key={opp.id}
                      className="hover:bg-muted/30 transition-colors cursor-pointer"
                      onClick={() => selectOpp(opp.id)}
                    >
                      <td className="px-6 py-4">
                        <p className="font-medium">{opp.customerName}</p>
                        {(opp.property?.city || opp.city) && (
                          <p className="text-[11px] text-muted-foreground">
                            {opp.property?.city ?? opp.city}, {opp.property?.state ?? opp.state}
                          </p>
                        )}
                        {opp.priority === 'emergency' && (
                          <AlertTriangle className="inline ml-1.5 h-3.5 w-3.5 text-red-500" />
                        )}
                      </td>
                      <td className="px-6 py-4 hidden sm:table-cell">
                        <span className="capitalize text-muted-foreground">{opp.serviceCategory}</span>
                      </td>
                      <td className="px-6 py-4 hidden md:table-cell">
                        {opp.technician?.user?.fullName ?? (
                          <span className="text-muted-foreground text-[11px]">Unassigned</span>
                        )}
                      </td>
                      <td className="px-6 py-4 hidden lg:table-cell">
                        {opp.scheduledStart ? (
                          <div>
                            <p className="text-[12px] font-medium">
                              {new Date(opp.scheduledStart).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                              })}
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              {new Date(opp.scheduledStart).toLocaleTimeString('en-US', {
                                hour: 'numeric',
                                minute: '2-digit',
                              })}
                            </p>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-[11px]">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right hidden lg:table-cell">
                        {opp.estimateAmount ? (
                          <span className="font-medium">{formatCurrency(Number(opp.estimateAmount))}</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <OppStageBadge stage={opp.stage} />
                      </td>
                      <td className="px-4 py-4 text-muted-foreground">
                        <ChevronRight className="h-4 w-4" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {!isLoading && filteredOpps.length > 0 && (
          <p className="text-[12px] text-muted-foreground">
            {filteredOpps.length} job{filteredOpps.length !== 1 ? 's' : ''}
            {activeStage !== 'all' && ` · ${activeStage.replace(/_/g, ' ')}`}
            {categoryFilter && ` · ${categoryFilter}`}
            {unassignedOnly && ` · unassigned`}
          </p>
        )}
      </div>

      {showCreate && (
        <CreateJobForm
          onClose={() => setShowCreate(false)}
          onSaved={(id) => {
            setShowCreate(false);
            selectOpp(id);
          }}
        />
      )}
    </>
  );
}
