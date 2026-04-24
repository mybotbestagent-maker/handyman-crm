'use client';

import { useState } from 'react';
import { Topbar } from '@/components/layout/topbar';
import { api } from '@/lib/trpc/client';
import {
  PhoneIncoming,
  Plus,
  Search,
  X,
  ArrowLeft,
  Loader2,
  Clock,
  MapPin,
  Zap,
  UserPlus,
  CheckCircle,
  AlertCircle,
  ChevronRight,
} from 'lucide-react';
import { formatDate, formatPhone } from '@/lib/utils';
import { LeadStatusBadge } from '@/components/shared/status-badges';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type LeadStatus = 'new' | 'contacted' | 'qualified' | 'converted' | 'dead';

const STATUS_TABS: { label: string; value: LeadStatus | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'New', value: 'new' },
  { label: 'Contacted', value: 'contacted' },
  { label: 'Qualified', value: 'qualified' },
  { label: 'Converted', value: 'converted' },
  { label: 'Dead', value: 'dead' },
];

// ── Lead Detail Panel ──────────────────────────────────────────────────────────

function LeadDetail({
  lead,
  onBack,
  onConvert,
  onStatusChange,
}: {
  lead: any;
  onBack: () => void;
  onConvert: (leadId: string) => void;
  onStatusChange: (leadId: string, status: LeadStatus) => void;
}) {
  const utils = api.useUtils();
  const updateStatusMutation = api.lead.updateStatus.useMutation({
    onSuccess: () => {
      utils.lead.list.invalidate();
      onBack();
    },
  });

  const transitions: { label: string; value: LeadStatus; variant: 'default' | 'outline' | 'destructive' }[] = [
    { label: 'Mark Contacted', value: 'contacted', variant: 'outline' },
    { label: 'Mark Qualified', value: 'qualified', variant: 'outline' },
    { label: 'Mark Dead', value: 'dead', variant: 'destructive' as any },
  ];

  const receivedAgo = (() => {
    const diff = Date.now() - new Date(lead.receivedAt).getTime();
    const h = Math.floor(diff / 3600000);
    if (h < 1) return 'just now';
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  })();

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
              <LeadStatusBadge status={lead.status} />
              <span className="text-xs text-muted-foreground capitalize">
                via {lead.source.replace(/_/g, ' ')}
              </span>
            </div>
            <h2 className="text-xl font-bold capitalize">{lead.serviceType} Request</h2>
            <div className="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {receivedAgo}
              </span>
              <span className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                ZIP {lead.zip}
              </span>
            </div>
          </div>
          {/* Score */}
          <div className="text-center">
            <div
              className={`flex h-14 w-14 items-center justify-center rounded-full text-lg font-bold ${
                lead.score >= 80
                  ? 'bg-green-100 text-green-700'
                  : lead.score >= 50
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-red-100 text-red-700'
              }`}
            >
              {lead.score}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">AI score</p>
          </div>
        </div>

        {/* Description */}
        <div className="mt-4 rounded-lg bg-muted/50 p-4">
          <p className="text-sm">{lead.description}</p>
        </div>
      </div>

      {/* Customer info */}
      {lead.customer && (
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <h3 className="text-sm font-semibold mb-3">Linked Customer</h3>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold">
              {lead.customer.billingName.charAt(0)}
            </div>
            <div>
              <p className="font-medium">{lead.customer.billingName}</p>
              {lead.customer.phone && (
                <p className="text-sm text-muted-foreground">{formatPhone(lead.customer.phone)}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="rounded-xl border bg-card p-6 shadow-sm space-y-3">
        <h3 className="text-sm font-semibold">Actions</h3>

        {lead.status !== 'converted' && lead.status !== 'dead' && (
          <Button
            className="w-full"
            onClick={() => onConvert(lead.id)}
          >
            <UserPlus className="h-4 w-4 mr-2" />
            Convert to Job
          </Button>
        )}

        <div className="flex gap-2 flex-wrap">
          {transitions
            .filter((t) => t.value !== lead.status)
            .map((t) => (
              <Button
                key={t.value}
                variant={t.variant as any}
                size="sm"
                disabled={updateStatusMutation.isPending}
                onClick={() =>
                  updateStatusMutation.mutate({ id: lead.id, status: t.value })
                }
              >
                {t.label}
              </Button>
            ))}
        </div>
      </div>
    </div>
  );
}

// ── Create Lead Form ───────────────────────────────────────────────────────────

function CreateLeadForm({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const utils = api.useUtils();
  const createMutation = api.lead.create.useMutation({
    onSuccess: () => {
      utils.lead.list.invalidate();
      onSaved();
    },
  });

  const [form, setForm] = useState({
    source: 'web_form',
    serviceType: '',
    description: '',
    zip: '',
    customerName: '',
    customerPhone: '',
    customerEmail: '',
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((prev) => ({ ...prev, [k]: e.target.value }));

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    createMutation.mutate({
      source: form.source,
      sourceMeta: {},
      serviceType: form.serviceType,
      description: form.description,
      zip: form.zip,
      customerName: form.customerName || undefined,
      customerPhone: form.customerPhone || undefined,
      customerEmail: form.customerEmail || undefined,
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
                value={form.source}
                onChange={set('source')}
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
              <Label>Service Type *</Label>
              <select
                value={form.serviceType}
                onChange={set('serviceType')}
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
            <Label>Description *</Label>
            <textarea
              value={form.description}
              onChange={set('description')}
              required
              rows={3}
              placeholder="Describe the service needed..."
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
            />
          </div>

          <div className="space-y-1.5">
            <Label>ZIP Code *</Label>
            <Input value={form.zip} onChange={set('zip')} placeholder="33131" required />
          </div>

          <div className="rounded-lg border p-4 space-y-3">
            <p className="text-sm font-medium">Customer Info (optional)</p>
            <Input value={form.customerName} onChange={set('customerName')} placeholder="Customer name" />
            <div className="grid grid-cols-2 gap-3">
              <Input value={form.customerPhone} onChange={set('customerPhone')} placeholder="Phone" />
              <Input value={form.customerEmail} onChange={set('customerEmail')} type="email" placeholder="Email" />
            </div>
          </div>

          {createMutation.error && (
            <p className="text-sm text-destructive">{createMutation.error.message}</p>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
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
  const [activeStatus, setActiveStatus] = useState<LeadStatus | 'all'>('all');
  const [selectedLead, setSelectedLead] = useState<any | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const { data, isLoading } = api.lead.list.useQuery({
    status: activeStatus === 'all' ? undefined : activeStatus,
    limit: 100,
  });

  const leads = data?.items ?? [];

  // Count per status for badges
  const { data: allData } = api.lead.list.useQuery({ limit: 100 });
  const allLeads = allData?.items ?? [];
  const countByStatus = allLeads.reduce((acc: Record<string, number>, l: any) => {
    acc[l.status] = (acc[l.status] ?? 0) + 1;
    return acc;
  }, {});

  if (selectedLead) {
    return (
      <>
        <Topbar title="Leads" />
        <LeadDetail
          lead={selectedLead}
          onBack={() => setSelectedLead(null)}
          onConvert={(id) => {
            // TODO: navigate to create job form with leadId pre-filled
            alert(`TODO: Convert lead ${id} to job — wire up in Week 4`);
          }}
          onStatusChange={() => setSelectedLead(null)}
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
          {/* Status tabs */}
          <div className="flex flex-wrap gap-1">
            {STATUS_TABS.map((tab) => {
              const count = tab.value === 'all'
                ? allLeads.length
                : countByStatus[tab.value] ?? 0;
              const isActive = tab.value === activeStatus;
              return (
                <button
                  key={tab.value}
                  onClick={() => setActiveStatus(tab.value)}
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
            { label: 'New', value: countByStatus['new'] ?? 0, icon: PhoneIncoming, color: 'text-blue-600', bg: 'bg-blue-50' },
            { label: 'Contacted', value: countByStatus['contacted'] ?? 0, icon: Clock, color: 'text-yellow-600', bg: 'bg-yellow-50' },
            { label: 'Qualified', value: countByStatus['qualified'] ?? 0, icon: Zap, color: 'text-purple-600', bg: 'bg-purple-50' },
            { label: 'Converted', value: countByStatus['converted'] ?? 0, icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50' },
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

        {/* Leads list */}
        <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center p-16">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : leads.length === 0 ? (
            <div className="p-16 text-center text-muted-foreground">
              <PhoneIncoming className="mx-auto h-10 w-10 mb-3 opacity-30" />
              <p className="font-medium">
                {activeStatus === 'all' ? 'No leads yet' : `No ${activeStatus} leads`}
              </p>
              <Button onClick={() => setShowCreate(true)} size="sm" className="mt-4">
                <Plus className="h-4 w-4 mr-1.5" />
                Add Lead
              </Button>
            </div>
          ) : (
            <div className="divide-y">
              {leads.map((lead: any) => {
                const receivedAgo = (() => {
                  const diff = Date.now() - new Date(lead.receivedAt).getTime();
                  const h = Math.floor(diff / 3600000);
                  if (h < 1) return 'just now';
                  if (h < 24) return `${h}h ago`;
                  return `${Math.floor(h / 24)}d ago`;
                })();

                return (
                  <div
                    key={lead.id}
                    className="flex items-start justify-between px-6 py-4 hover:bg-muted/30 transition-colors cursor-pointer"
                    onClick={() => setSelectedLead(lead)}
                  >
                    <div className="flex items-start gap-4 flex-1 min-w-0">
                      {/* Score */}
                      <div
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                          lead.score >= 80
                            ? 'bg-green-100 text-green-700'
                            : lead.score >= 50
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {lead.score}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="font-medium capitalize">{lead.serviceType}</span>
                          <span className="text-muted-foreground text-xs">ZIP {lead.zip}</span>
                          <span className="text-muted-foreground text-xs capitalize">
                            · {lead.source.replace(/_/g, ' ')}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {lead.description}
                        </p>
                        {lead.customer && (
                          <p className="mt-1 text-xs text-primary font-medium">
                            {lead.customer.billingName}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="ml-4 flex flex-col items-end gap-2 shrink-0">
                      <LeadStatusBadge status={lead.status} />
                      <span className="text-xs text-muted-foreground">{receivedAgo}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {showCreate && (
        <CreateLeadForm
          onClose={() => setShowCreate(false)}
          onSaved={() => setShowCreate(false)}
        />
      )}
    </>
  );
}
