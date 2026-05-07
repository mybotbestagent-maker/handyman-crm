'use client';

/**
 * Leads page — T-CORE-OPPORTUNITY Step 5 UI cutover.
 *
 * Reads from opportunityRouter instead of leadRouter.
 * Shows opportunities in lead stages: new_lead | ai_responding | qualified |
 * estimate_sent | estimate_approved.
 *
 * Old leadRouter is still registered and functional — will be removed after
 * Step 6 (final cutover + drop legacy tables).
 */

import { useState } from 'react';
import { Topbar } from '@/components/layout/topbar';
import { api } from '@/lib/trpc/client';
import {
  PhoneIncoming,
  Plus,
  X,
  ArrowLeft,
  Loader2,
  Clock,
  MapPin,
  Zap,
  UserPlus,
  ChevronRight,
  Bot,
  FileText,
  ThumbsUp,
} from 'lucide-react';
import { formatDate, formatPhone } from '@/lib/utils';
import { OppStageBadge } from '@/components/shared/status-badges';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// Stage groups shown on this (leads) page
const LEAD_STAGES = [
  'new_lead',
  'ai_responding',
  'qualified',
  'estimate_sent',
  'estimate_approved',
] as const;

type LeadStageFilter = (typeof LEAD_STAGES)[number] | 'all';

const STAGE_TABS: { label: string; value: LeadStageFilter }[] = [
  { label: 'All', value: 'all' },
  { label: 'New', value: 'new_lead' },
  { label: 'AI Responding', value: 'ai_responding' },
  { label: 'Qualified', value: 'qualified' },
  { label: 'Estimate Sent', value: 'estimate_sent' },
  { label: 'Est. Approved', value: 'estimate_approved' },
];

// ── Opportunity Detail Panel ───────────────────────────────────────────────────

function OppDetail({
  opp,
  onBack,
  onTransition,
}: {
  opp: any;
  onBack: () => void;
  onTransition: () => void;
}) {
  const utils = api.useUtils();

  const transitionMutation = api.opportunity.transitionStage.useMutation({
    onSuccess: () => {
      utils.opportunity.list.invalidate();
      onTransition();
    },
  });

  const receivedAgo = (() => {
    const diff = Date.now() - new Date(opp.createdAt).getTime();
    const h = Math.floor(diff / 3600000);
    if (h < 1) return 'just now';
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  })();

  const nextStages: { label: string; toStage: string; variant: 'default' | 'outline' | 'destructive' }[] = [];
  if (opp.stage === 'new_lead') {
    nextStages.push({ label: 'Mark AI Responding', toStage: 'ai_responding', variant: 'outline' });
    nextStages.push({ label: 'Mark Qualified', toStage: 'qualified', variant: 'outline' });
    nextStages.push({ label: 'Mark Lost', toStage: 'lost', variant: 'destructive' });
  } else if (opp.stage === 'ai_responding') {
    nextStages.push({ label: 'Mark Qualified', toStage: 'qualified', variant: 'outline' });
    nextStages.push({ label: 'Mark Lost', toStage: 'lost', variant: 'destructive' });
  } else if (opp.stage === 'qualified') {
    nextStages.push({ label: 'Send Estimate', toStage: 'estimate_sent', variant: 'outline' });
    nextStages.push({ label: 'Create Job', toStage: 'job_created', variant: 'default' });
    nextStages.push({ label: 'Mark Lost', toStage: 'lost', variant: 'destructive' });
  } else if (opp.stage === 'estimate_sent') {
    nextStages.push({ label: 'Estimate Approved', toStage: 'estimate_approved', variant: 'default' });
    nextStages.push({ label: 'Mark Lost', toStage: 'lost', variant: 'destructive' });
  } else if (opp.stage === 'estimate_approved') {
    nextStages.push({ label: 'Create Job', toStage: 'job_created', variant: 'default' });
    nextStages.push({ label: 'Mark Lost', toStage: 'lost', variant: 'destructive' });
  }

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to leads
      </button>

      {/* Header card */}
      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <OppStageBadge stage={opp.stage} />
              <span className="text-xs text-muted-foreground capitalize">
                via {opp.sourceId?.replace(/_/g, ' ') ?? 'unknown'}
              </span>
            </div>
            <h2 className="text-xl font-bold capitalize">{opp.serviceCategory} Request</h2>
            <div className="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {receivedAgo}
              </span>
              {opp.zip && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  ZIP {opp.zip}
                </span>
              )}
              {opp.city && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  {opp.city}, {opp.state}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Description */}
        {opp.description && (
          <div className="mt-4 rounded-lg bg-muted/50 p-4">
            <p className="text-sm">{opp.description}</p>
          </div>
        )}
      </div>

      {/* Contact info */}
      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <h3 className="text-sm font-semibold mb-3">Contact</h3>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold">
            {opp.customerName?.charAt(0) ?? '?'}
          </div>
          <div>
            <p className="font-medium">{opp.customerName}</p>
            {opp.customerPhone && (
              <p className="text-sm text-muted-foreground">{formatPhone(opp.customerPhone)}</p>
            )}
            {opp.customerEmail && (
              <p className="text-sm text-muted-foreground">{opp.customerEmail}</p>
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="rounded-xl border bg-card p-6 shadow-sm space-y-3">
        <h3 className="text-sm font-semibold">Actions</h3>

        {(opp.stage === 'qualified' || opp.stage === 'estimate_approved') && (
          <Button
            className="w-full"
            disabled={transitionMutation.isPending}
            onClick={() =>
              transitionMutation.mutate({ id: opp.id, toStage: 'job_created' })
            }
          >
            <UserPlus className="h-4 w-4 mr-2" />
            Convert to Job
          </Button>
        )}

        <div className="flex gap-2 flex-wrap">
          {nextStages
            .filter((t) => t.toStage !== 'job_created')
            .map((t) => (
              <Button
                key={t.toStage}
                variant={t.variant}
                size="sm"
                disabled={transitionMutation.isPending}
                onClick={() =>
                  transitionMutation.mutate({
                    id: opp.id,
                    toStage: t.toStage as any,
                    ...(t.toStage === 'lost' && { lostReason: 'no_response' }),
                  })
                }
              >
                {t.label}
              </Button>
            ))}
        </div>

        {transitionMutation.error && (
          <p className="text-sm text-destructive">{transitionMutation.error.message}</p>
        )}
      </div>
    </div>
  );
}

// ── Create Opportunity Form ────────────────────────────────────────────────────

function CreateOppForm({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const utils = api.useUtils();
  const createMutation = api.opportunity.create.useMutation({
    onSuccess: () => {
      utils.opportunity.list.invalidate();
      onSaved();
    },
  });

  const [form, setForm] = useState({
    sourceId: 'web_form',
    serviceCategory: '',
    description: '',
    zip: '',
    customerName: '',
    customerPhone: '',
    customerEmail: '',
    city: '',
    state: '',
  });

  const set =
    (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((prev) => ({ ...prev, [k]: e.target.value }));

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    createMutation.mutate({
      sourceId: form.sourceId,
      serviceCategory: form.serviceCategory,
      description: form.description || undefined,
      zip: form.zip || undefined,
      customerName: form.customerName,
      customerPhone: form.customerPhone || undefined,
      customerEmail: form.customerEmail || undefined,
      city: form.city || undefined,
      state: form.state || undefined,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-xl bg-background border shadow-xl overflow-y-auto max-h-[90vh]">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h2 className="text-lg font-semibold">New Lead</h2>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-accent transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Source *</Label>
              <select
                value={form.sourceId}
                onChange={set('sourceId')}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="google_lsa">Google LSA</option>
                <option value="thumbtack">Thumbtack</option>
                <option value="yelp">Yelp</option>
                <option value="referral">Referral</option>
                <option value="web_form">Web Form</option>
                <option value="phone">Phone</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Service Category *</Label>
              <select
                value={form.serviceCategory}
                onChange={set('serviceCategory')}
                required
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">— Select —</option>
                <option value="plumbing">Plumbing</option>
                <option value="electrical">Electrical</option>
                <option value="carpentry">Carpentry</option>
                <option value="general">General</option>
                <option value="painting">Painting</option>
                <option value="hvac">HVAC</option>
                <option value="tiling">Tiling</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Description</Label>
            <textarea
              value={form.description}
              onChange={set('description')}
              rows={3}
              placeholder="Describe the service needed..."
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>ZIP</Label>
              <Input value={form.zip} onChange={set('zip')} placeholder="33131" />
            </div>
            <div className="space-y-1.5">
              <Label>City</Label>
              <Input value={form.city} onChange={set('city')} placeholder="Miami" />
            </div>
            <div className="space-y-1.5">
              <Label>State</Label>
              <Input value={form.state} onChange={set('state')} placeholder="FL" />
            </div>
          </div>

          <div className="rounded-lg border p-4 space-y-3">
            <p className="text-sm font-medium">Customer Info *</p>
            <Input
              value={form.customerName}
              onChange={set('customerName')}
              placeholder="Customer name"
              required
            />
            <div className="grid grid-cols-2 gap-3">
              <Input value={form.customerPhone} onChange={set('customerPhone')} placeholder="Phone" />
              <Input
                value={form.customerEmail}
                onChange={set('customerEmail')}
                type="email"
                placeholder="Email"
              />
            </div>
          </div>

          {createMutation.error && (
            <p className="text-sm text-destructive">{createMutation.error.message}</p>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Lead
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main Leads Page ────────────────────────────────────────────────────────────

export default function LeadsPage() {
  const [activeStage, setActiveStage] = useState<LeadStageFilter>('all');
  const [selectedOpp, setSelectedOpp] = useState<any | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  // Filtered list
  const { data, isLoading } = api.opportunity.list.useQuery({
    stages: activeStage === 'all' ? [...LEAD_STAGES] : [activeStage],
    limit: 100,
  });

  // All lead-stage opps for counts
  const { data: allData } = api.opportunity.list.useQuery({
    stages: [...LEAD_STAGES],
    limit: 100,
  });

  const opps = data?.items ?? [];
  const allOpps = allData?.items ?? [];

  const countByStage = allOpps.reduce((acc: Record<string, number>, o: any) => {
    acc[o.stage] = (acc[o.stage] ?? 0) + 1;
    return acc;
  }, {});

  if (selectedOpp) {
    return (
      <>
        <Topbar title="Leads" />
        <OppDetail
          opp={selectedOpp}
          onBack={() => setSelectedOpp(null)}
          onTransition={() => setSelectedOpp(null)}
        />
      </>
    );
  }

  return (
    <>
      <Topbar title="Leads" />

      <div className="p-6 space-y-5">
        {/* Toolbar */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Stage tabs */}
          <div className="flex flex-wrap gap-1">
            {STAGE_TABS.map((tab) => {
              const count =
                tab.value === 'all'
                  ? allOpps.length
                  : countByStage[tab.value] ?? 0;
              const isActive = tab.value === activeStage;
              return (
                <button
                  key={tab.value}
                  onClick={() => setActiveStage(tab.value)}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'
                  }`}
                >
                  {tab.label}
                  {count > 0 && (
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-xs font-bold ${
                        isActive ? 'bg-white/20 text-white' : 'bg-background text-foreground'
                      }`}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <Button onClick={() => setShowCreate(true)} size="sm">
            <Plus className="h-4 w-4 mr-1.5" />
            New Lead
          </Button>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            {
              label: 'New',
              value: countByStage['new_lead'] ?? 0,
              icon: PhoneIncoming,
              color: 'text-blue-600',
              bg: 'bg-blue-50',
            },
            {
              label: 'AI Responding',
              value: countByStage['ai_responding'] ?? 0,
              icon: Bot,
              color: 'text-sky-600',
              bg: 'bg-sky-50',
            },
            {
              label: 'Qualified',
              value: countByStage['qualified'] ?? 0,
              icon: Zap,
              color: 'text-purple-600',
              bg: 'bg-purple-50',
            },
            {
              label: 'Estimates',
              value:
                (countByStage['estimate_sent'] ?? 0) +
                (countByStage['estimate_approved'] ?? 0),
              icon: FileText,
              color: 'text-cyan-600',
              bg: 'bg-cyan-50',
            },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border bg-card p-4 shadow-sm">
              <div className={`inline-flex h-8 w-8 items-center justify-center rounded-lg ${s.bg} mb-2`}>
                <s.icon className={`h-4 w-4 ${s.color}`} />
              </div>
              <p className="text-2xl font-bold">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Opps list */}
        <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center p-16">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : opps.length === 0 ? (
            <div className="p-16 text-center text-muted-foreground">
              <PhoneIncoming className="mx-auto h-10 w-10 mb-3 opacity-30" />
              <p className="font-medium">
                {activeStage === 'all' ? 'No leads yet' : `No leads in this stage`}
              </p>
              <Button onClick={() => setShowCreate(true)} size="sm" className="mt-4">
                <Plus className="h-4 w-4 mr-1.5" />
                Add Lead
              </Button>
            </div>
          ) : (
            <div className="divide-y">
              {opps.map((opp: any) => {
                const receivedAgo = (() => {
                  const diff = Date.now() - new Date(opp.createdAt).getTime();
                  const h = Math.floor(diff / 3600000);
                  if (h < 1) return 'just now';
                  if (h < 24) return `${h}h ago`;
                  return `${Math.floor(h / 24)}d ago`;
                })();

                return (
                  <div
                    key={opp.id}
                    className="flex items-start justify-between px-6 py-4 hover:bg-muted/30 transition-colors cursor-pointer"
                    onClick={() => setSelectedOpp(opp)}
                  >
                    <div className="flex items-start gap-4 flex-1 min-w-0">
                      {/* Avatar initials */}
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-bold">
                        {opp.customerName?.charAt(0) ?? '?'}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="font-medium capitalize">{opp.serviceCategory}</span>
                          {opp.zip && (
                            <span className="text-muted-foreground text-xs">ZIP {opp.zip}</span>
                          )}
                          {opp.city && (
                            <span className="text-muted-foreground text-xs">{opp.city}, {opp.state}</span>
                          )}
                          <span className="text-muted-foreground text-xs capitalize">
                            · {opp.sourceId?.replace(/_/g, ' ') ?? 'unknown'}
                          </span>
                        </div>
                        <p className="text-sm font-medium text-foreground">{opp.customerName}</p>
                        {opp.description && (
                          <p className="text-sm text-muted-foreground line-clamp-1 mt-0.5">
                            {opp.description}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="ml-4 flex flex-col items-end gap-2 shrink-0">
                      <OppStageBadge stage={opp.stage} />
                      <span className="text-xs text-muted-foreground">{receivedAgo}</span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {showCreate && (
        <CreateOppForm
          onClose={() => setShowCreate(false)}
          onSaved={() => setShowCreate(false)}
        />
      )}
    </>
  );
}
