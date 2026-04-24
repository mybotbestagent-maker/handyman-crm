'use client';

import { useState } from 'react';
import { Topbar } from '@/components/layout/topbar';
import { api } from '@/lib/trpc/client';
import {
  Plus,
  ArrowLeft,
  Loader2,
  X,
  MapPin,
  User,
  Calendar,
  DollarSign,
  Clock,
  Star,
  Wrench,
  ChevronRight,
  AlertTriangle,
  CheckCircle,
} from 'lucide-react';
import { formatCurrency, formatDate, formatPhone } from '@/lib/utils';
import { JobStatusBadge, PriorityBadge } from '@/components/shared/status-badges';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type JobStatus =
  | 'new' | 'scheduled' | 'dispatched' | 'en_route'
  | 'on_site' | 'in_progress' | 'completed' | 'invoiced'
  | 'paid' | 'closed' | 'canceled';

const STATUS_TABS: { label: string; value: JobStatus | 'all'; color?: string }[] = [
  { label: 'All', value: 'all' },
  { label: 'New', value: 'new' },
  { label: 'Scheduled', value: 'scheduled' },
  { label: 'Dispatched', value: 'dispatched' },
  { label: 'En Route', value: 'en_route' },
  { label: 'On Site', value: 'on_site' },
  { label: 'In Progress', value: 'in_progress' },
  { label: 'Completed', value: 'completed' },
  { label: 'Invoiced', value: 'invoiced' },
  { label: 'Paid', value: 'paid' },
];

// ── Status transition map ────────────────────────────────────────────────────

const STATUS_TRANSITIONS: Partial<Record<JobStatus, JobStatus[]>> = {
  new:         ['scheduled', 'canceled'],
  scheduled:   ['dispatched', 'canceled'],
  dispatched:  ['en_route', 'canceled'],
  en_route:    ['on_site'],
  on_site:     ['in_progress'],
  in_progress: ['completed'],
  completed:   ['invoiced'],
  invoiced:    ['paid'],
  paid:        ['closed'],
};

const STATUS_LABELS: Partial<Record<JobStatus, string>> = {
  scheduled:   'Mark Scheduled',
  dispatched:  'Dispatch Tech',
  en_route:    'Tech En Route',
  on_site:     'On Site',
  in_progress: 'Start Work',
  completed:   'Mark Complete',
  invoiced:    'Invoice Sent',
  paid:        'Mark Paid',
  closed:      'Close Job',
  canceled:    'Cancel',
};

// ── Job Detail ───────────────────────────────────────────────────────────────

function JobDetail({ jobId, onBack }: { jobId: string; onBack: () => void }) {
  const utils = api.useUtils();
  const { data: job, isLoading } = api.job.byId.useQuery({ id: jobId });

  const updateStatus = api.job.updateStatus.useMutation({
    onSuccess: () => {
      utils.job.byId.invalidate({ id: jobId });
      utils.job.list.invalidate();
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!job) return null;

  const transitions = STATUS_TRANSITIONS[job.status as JobStatus] ?? [];

  const totalRevenue = job.items?.reduce(
    (sum: number, item: any) => sum + Number(item.total),
    0,
  ) ?? 0;

  const address = job.property
    ? `${job.property.addressLine1}, ${job.property.city}, ${job.property.state}`
    : '—';

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to jobs
      </button>

      {/* Header */}
      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-sm font-bold text-primary">{job.jobNumber}</span>
              <JobStatusBadge status={job.status} />
              <PriorityBadge priority={job.priority} />
            </div>
            <h2 className="text-xl font-bold capitalize">
              {job.category} — {job.jobType}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">{job.description}</p>
          </div>
        </div>

        {/* Status transitions */}
        {transitions.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {transitions.map((nextStatus) => (
              <Button
                key={nextStatus}
                size="sm"
                variant={nextStatus === 'canceled' ? 'destructive' : nextStatus === 'completed' || nextStatus === 'paid' ? 'default' : 'outline'}
                disabled={updateStatus.isPending}
                onClick={() =>
                  updateStatus.mutate({ jobId: job.id, status: nextStatus })
                }
              >
                {updateStatus.isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                {STATUS_LABELS[nextStatus] ?? nextStatus}
              </Button>
            ))}
          </div>
        )}
      </div>

      {/* Info grid */}
      <div className="grid grid-cols-2 gap-4">
        {/* Customer */}
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <p className="text-xs text-muted-foreground mb-2">Customer</p>
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm">
              {job.customer?.billingName?.charAt(0) ?? '?'}
            </div>
            <div>
              <p className="font-semibold text-sm">{job.customer?.billingName}</p>
              {job.customer?.phone && (
                <p className="text-xs text-muted-foreground">{formatPhone(job.customer.phone)}</p>
              )}
            </div>
          </div>
        </div>

        {/* Technician */}
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <p className="text-xs text-muted-foreground mb-2">Technician</p>
          {job.technician ? (
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 font-semibold text-sm">
                {job.technician.user?.fullName?.charAt(0) ?? 'T'}
              </div>
              <div>
                <p className="font-semibold text-sm">{job.technician.user?.fullName}</p>
                {job.technician.rating && (
                  <p className="flex items-center gap-0.5 text-xs text-muted-foreground">
                    <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                    {Number(job.technician.rating).toFixed(1)}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Wrench className="h-4 w-4" />
              <span className="text-sm">Unassigned</span>
            </div>
          )}
        </div>

        {/* Schedule */}
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <p className="text-xs text-muted-foreground mb-2">Scheduled</p>
          {job.scheduledStart ? (
            <div>
              <p className="font-semibold text-sm">{formatDate(job.scheduledStart)}</p>
              <p className="text-xs text-muted-foreground">
                {new Date(job.scheduledStart).toLocaleTimeString('en-US', {
                  hour: 'numeric',
                  minute: '2-digit',
                })}
                {job.scheduledEnd &&
                  ` – ${new Date(job.scheduledEnd).toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                  })}`}
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Not scheduled</p>
          )}
        </div>

        {/* Revenue */}
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <p className="text-xs text-muted-foreground mb-2">Revenue</p>
          <p className="font-bold text-lg text-primary">
            {job.actualRevenue
              ? formatCurrency(Number(job.actualRevenue))
              : job.estimatedRevenue
              ? `~${formatCurrency(Number(job.estimatedRevenue))}`
              : '—'}
          </p>
          {job.estimatedRevenue && job.actualRevenue && (
            <p className="text-xs text-muted-foreground">est. {formatCurrency(Number(job.estimatedRevenue))}</p>
          )}
        </div>
      </div>

      {/* Address */}
      <div className="rounded-xl border bg-card p-5 shadow-sm flex items-start gap-3">
        <MapPin className="h-5 w-5 text-primary shrink-0 mt-0.5" />
        <div>
          <p className="text-xs text-muted-foreground mb-0.5">Service Address</p>
          <p className="font-medium text-sm">{address}</p>
          {job.property?.accessNotes && (
            <p className="mt-1 text-xs text-amber-600">Access: {job.property.accessNotes}</p>
          )}
        </div>
      </div>

      {/* Job Items */}
      {job.items && job.items.length > 0 && (
        <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
          <div className="border-b px-6 py-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Line Items</h3>
            <span className="text-sm font-bold text-primary">
              {formatCurrency(totalRevenue)}
            </span>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-6 py-2.5 text-left text-xs font-medium text-muted-foreground">Item</th>
                <th className="px-4 py-2.5 text-right text-xs font-medium text-muted-foreground">Qty</th>
                <th className="px-4 py-2.5 text-right text-xs font-medium text-muted-foreground">Unit Price</th>
                <th className="px-6 py-2.5 text-right text-xs font-medium text-muted-foreground">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {job.items.map((item: any) => (
                <tr key={item.id} className={item.itemType === 'discount' ? 'text-green-700' : ''}>
                  <td className="px-6 py-3">
                    <p className="font-medium">{item.name}</p>
                    <p className="text-xs text-muted-foreground capitalize">{item.itemType}</p>
                  </td>
                  <td className="px-4 py-3 text-right">{Number(item.qty)}</td>
                  <td className="px-4 py-3 text-right">{formatCurrency(Number(item.unitPrice))}</td>
                  <td className="px-6 py-3 text-right font-medium">
                    {Number(item.total) < 0
                      ? `(${formatCurrency(Math.abs(Number(item.total)))})`
                      : formatCurrency(Number(item.total))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Notes */}
      {job.internalNotes && (
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <h3 className="text-sm font-semibold mb-2">Internal Notes</h3>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{job.internalNotes}</p>
        </div>
      )}

      {/* Customer rating */}
      {job.customerRating && (
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <h3 className="text-sm font-semibold mb-2">Customer Rating</h3>
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((s) => (
              <Star
                key={s}
                className={`h-5 w-5 ${
                  job.customerRating != null && s <= job.customerRating
                    ? 'fill-amber-400 text-amber-400'
                    : 'text-muted fill-muted'
                }`}
              />
            ))}
            <span className="ml-2 text-sm font-medium">{job.customerRating}/5</span>
          </div>
          {job.customerReview && (
            <p className="mt-2 text-sm text-muted-foreground">{job.customerReview}</p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Create Job Form ───────────────────────────────────────────────────────────

function CreateJobForm({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: (id: string) => void;
}) {
  const utils = api.useUtils();

  // Load customers for selector
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
    internalNotes: '',
  });

  const createMutation = api.job.create.useMutation({
    onSuccess: (data) => {
      utils.job.list.invalidate();
      onSaved(data.id);
    },
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
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
      internalNotes: form.internalNotes || undefined,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-xl bg-background border shadow-xl overflow-y-auto max-h-[90vh]">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h2 className="text-lg font-semibold">New Job</h2>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-accent transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Customer */}
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
                <option key={c.id} value={c.id}>{c.billingName}</option>
              ))}
            </select>
          </div>

          {/* Property */}
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
              <select value={form.jobType} onChange={set('jobType')}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <option value="repair">Repair</option>
                <option value="install">Install</option>
                <option value="maintenance">Maintenance</option>
                <option value="inspection">Inspection</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Category *</Label>
              <select value={form.category} onChange={set('category')}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <option value="general">General</option>
                <option value="plumbing">Plumbing</option>
                <option value="electrical">Electrical</option>
                <option value="carpentry">Carpentry</option>
                <option value="painting">Painting</option>
                <option value="hvac">HVAC</option>
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

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Priority</Label>
              <select value={form.priority} onChange={set('priority')}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="emergency">Emergency</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Est. Revenue ($)</Label>
              <Input
                type="number"
                value={form.estimatedRevenue}
                onChange={set('estimatedRevenue')}
                placeholder="350"
                min="0"
                step="0.01"
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
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={createMutation.isPending || !form.customerId || !form.propertyId}>
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
  const [activeStatus, setActiveStatus] = useState<JobStatus | 'all'>('all');
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const { data, isLoading } = api.job.list.useQuery({
    status: activeStatus === 'all' ? undefined : activeStatus,
    limit: 100,
  });

  const jobs = data?.items ?? [];

  // Count all for badges
  const { data: allData } = api.job.list.useQuery({ limit: 200 });
  const allJobs = allData?.items ?? [];
  const countByStatus = allJobs.reduce((acc: Record<string, number>, j: any) => {
    acc[j.status] = (acc[j.status] ?? 0) + 1;
    return acc;
  }, {});

  if (selectedJobId) {
    return (
      <>
        <Topbar title="Jobs" />
        <JobDetail
          jobId={selectedJobId}
          onBack={() => setSelectedJobId(null)}
        />
        {showCreate && (
          <CreateJobForm
            onClose={() => setShowCreate(false)}
            onSaved={(id) => { setShowCreate(false); setSelectedJobId(id); }}
          />
        )}
      </>
    );
  }

  return (
    <>
      <Topbar title="Jobs" />

      <div className="p-6 space-y-5">
        {/* Toolbar */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Status tabs — scrollable */}
          <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-none">
            {STATUS_TABS.map((tab) => {
              const count = tab.value === 'all' ? allJobs.length : countByStatus[tab.value] ?? 0;
              const isActive = tab.value === activeStatus;
              return (
                <button
                  key={tab.value}
                  onClick={() => setActiveStatus(tab.value)}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors ${
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

          <Button onClick={() => setShowCreate(true)} size="sm" className="shrink-0">
            <Plus className="h-4 w-4 mr-1.5" />
            New Job
          </Button>
        </div>

        {/* Jobs table */}
        <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center p-16">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : jobs.length === 0 ? (
            <div className="p-16 text-center text-muted-foreground">
              <Wrench className="mx-auto h-10 w-10 mb-3 opacity-30" />
              <p className="font-medium">
                {activeStatus === 'all' ? 'No jobs yet' : `No ${activeStatus.replace('_', ' ')} jobs`}
              </p>
              <Button onClick={() => setShowCreate(true)} size="sm" className="mt-4">
                <Plus className="h-4 w-4 mr-1.5" />
                Create Job
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Job #</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Customer</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide hidden sm:table-cell">Category</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide hidden md:table-cell">Technician</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide hidden lg:table-cell">Scheduled</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wide hidden lg:table-cell">Revenue</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Status</th>
                    <th className="px-4 py-3 w-8" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {jobs.map((job: any) => (
                    <tr
                      key={job.id}
                      className="hover:bg-muted/30 transition-colors cursor-pointer"
                      onClick={() => setSelectedJobId(job.id)}
                    >
                      <td className="px-6 py-4">
                        <span className="font-mono text-xs font-bold text-primary">
                          {job.jobNumber}
                        </span>
                        {job.priority === 'emergency' && (
                          <AlertTriangle className="inline ml-1.5 h-3.5 w-3.5 text-red-500" />
                        )}
                        {job.priority === 'high' && (
                          <AlertTriangle className="inline ml-1.5 h-3.5 w-3.5 text-orange-500" />
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-medium">{job.customer?.billingName}</p>
                        {job.property && (
                          <p className="text-xs text-muted-foreground">
                            {job.property.city}, {job.property.state}
                          </p>
                        )}
                      </td>
                      <td className="px-6 py-4 hidden sm:table-cell">
                        <span className="capitalize text-muted-foreground">{job.category}</span>
                      </td>
                      <td className="px-6 py-4 hidden md:table-cell">
                        {job.technician?.user?.fullName ?? (
                          <span className="text-muted-foreground text-xs">Unassigned</span>
                        )}
                      </td>
                      <td className="px-6 py-4 hidden lg:table-cell">
                        {job.scheduledStart ? (
                          <div>
                            <p className="text-xs font-medium">
                              {new Date(job.scheduledStart).toLocaleDateString('en-US', {
                                month: 'short', day: 'numeric',
                              })}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(job.scheduledStart).toLocaleTimeString('en-US', {
                                hour: 'numeric', minute: '2-digit',
                              })}
                            </p>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right hidden lg:table-cell">
                        {job.estimatedRevenue ? (
                          <span className="font-medium">{formatCurrency(Number(job.estimatedRevenue))}</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <JobStatusBadge status={job.status} />
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

        {!isLoading && jobs.length > 0 && (
          <p className="text-xs text-muted-foreground">
            {jobs.length} job{jobs.length !== 1 ? 's' : ''}
            {activeStatus !== 'all' && ` with status "${activeStatus.replace('_', ' ')}"`}
          </p>
        )}
      </div>

      {showCreate && (
        <CreateJobForm
          onClose={() => setShowCreate(false)}
          onSaved={(id) => { setShowCreate(false); setSelectedJobId(id); }}
        />
      )}
    </>
  );
}
