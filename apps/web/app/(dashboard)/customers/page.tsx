'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Topbar } from '@/components/layout/topbar';
import { api } from '@/lib/trpc/client';
import {
  Search,
  Plus,
  User,
  Building2,
  Phone,
  Mail,
  MapPin,
  Briefcase,
  DollarSign,
  X,
  ChevronRight,
  Star,
  ArrowLeft,
  Loader2,
  TrendingUp,
  Wallet,
  AlertCircle,
  Clock,
  Receipt,
  Wrench,
} from 'lucide-react';
import { formatCurrency, formatDate, formatPhone } from '@/lib/utils';
import { CustomerTypeBadge, InvoiceStatusBadge } from '@/components/shared/status-badges';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { JobStatusBadge } from '@/components/shared/status-badges';

// ── Customer Detail Panel ──────────────────────────────────────────────────────

function CustomerDetail({
  customerId,
  onBack,
  onEdit,
}: {
  customerId: string;
  onBack: () => void;
  onEdit: (id: string) => void;
}) {
  const { data: customer, isLoading } = api.customer.byId.useQuery({ id: customerId });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!customer) return null;

  const address = (() => {
    try {
      return typeof customer.billingAddress === 'string'
        ? JSON.parse(customer.billingAddress)
        : customer.billingAddress;
    } catch {
      return {};
    }
  })();

  const stats = (customer as any).stats ?? {
    totalSpent: 0,
    totalInvoiced: 0,
    outstandingBalance: 0,
    avgTicket: 0,
    totalJobs: customer.jobs?.length ?? 0,
    completedJobs: 0,
    firstService: null,
    lastService: null,
    daysSinceLast: null,
    categoryBreakdown: {},
    overdueCount: 0,
    invoiceCount: 0,
  };

  const topCategories = Object.entries(stats.categoryBreakdown as Record<string, number>)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 4);

  return (
    <div className="px-4 md:px-10 py-8 md:py-10 max-w-[1400px] mx-auto space-y-8 mt-12 md:mt-0">
      {/* Back */}
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to customers
      </button>

      {/* Hero header */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 border-b border-border pb-6 md:pb-8">
        <div className="flex items-center gap-5">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[hsl(var(--primary))] text-2xl font-black text-white shrink-0">
            {customer.type === 'commercial' ? (
              <Building2 className="h-7 w-7" />
            ) : (
              customer.billingName.charAt(0).toUpperCase()
            )}
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground mb-3">
              Customer · {customer.type}
              {customer.source && ` · via ${customer.source.replace(/_/g, ' ')}`}
            </p>
            <h1 className="hero-headline !text-[36px] md:!text-[48px]">{customer.billingName}</h1>
            {customer.companyName && (
              <p className="mt-2 text-[14px] text-muted-foreground">{customer.companyName}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 self-start md:self-auto">
          <Button size="sm" variant="outline" onClick={() => onEdit(customer.id)}>
            Edit
          </Button>
          <Button size="sm" className="btn-orange !py-2 !px-4 !text-[13px]">
            <Plus className="h-4 w-4 mr-1.5" />
            New Job
          </Button>
        </div>
      </div>

      {/* Auto-calculated stats — 4 big cards */}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card-premium p-7">
          <div className="flex items-center justify-between mb-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Total Spent
            </p>
            <Wallet className="h-[18px] w-[18px] text-muted-foreground/60" />
          </div>
          <p className="stat-display text-[hsl(var(--primary))]">
            {formatCurrency(stats.totalSpent)}
          </p>
          <p className="mt-2 text-[13px] text-muted-foreground">
            From {stats.invoiceCount} invoice{stats.invoiceCount !== 1 ? 's' : ''}
          </p>
        </div>

        <div className="card-premium p-7">
          <div className="flex items-center justify-between mb-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Avg Ticket
            </p>
            <TrendingUp className="h-[18px] w-[18px] text-muted-foreground/60" />
          </div>
          <p className="stat-display">{formatCurrency(stats.avgTicket)}</p>
          <p className="mt-2 text-[13px] text-muted-foreground">
            {stats.completedJobs} completed job{stats.completedJobs !== 1 ? 's' : ''}
          </p>
        </div>

        <div className="card-premium p-7">
          <div className="flex items-center justify-between mb-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Total Jobs
            </p>
            <Briefcase className="h-[18px] w-[18px] text-muted-foreground/60" />
          </div>
          <p className="stat-display">{stats.totalJobs}</p>
          <p className="mt-2 text-[13px] text-muted-foreground">
            {stats.lastService
              ? `Last: ${formatDate(stats.lastService)} · ${stats.daysSinceLast ?? 0}d ago`
              : 'No service yet'}
          </p>
        </div>

        <div
          className={`card-premium p-7 ${
            stats.outstandingBalance > 0 ? 'border-amber-300 bg-amber-50/40' : ''
          }`}
        >
          <div className="flex items-center justify-between mb-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Outstanding
            </p>
            {stats.overdueCount > 0 ? (
              <AlertCircle className="h-[18px] w-[18px] text-red-500" />
            ) : (
              <DollarSign className="h-[18px] w-[18px] text-muted-foreground/60" />
            )}
          </div>
          <p
            className={`stat-display ${
              stats.outstandingBalance > 0 ? 'text-amber-600' : 'text-muted-foreground'
            }`}
          >
            {formatCurrency(stats.outstandingBalance)}
          </p>
          <p className="mt-2 text-[13px] text-muted-foreground">
            {stats.overdueCount > 0 ? (
              <span className="text-red-600 font-medium">
                {stats.overdueCount} overdue
              </span>
            ) : (
              'All clear'
            )}
          </p>
        </div>
      </div>

      {/* Two-column: contact + categories */}
      <div className="grid gap-5 lg:grid-cols-3">
        {/* Contact card */}
        <div className="card-premium p-7 lg:col-span-2">
          <div className="flex items-center gap-2 mb-6">
            <User className="h-[18px] w-[18px] text-muted-foreground/60" />
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Contact
            </h3>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex items-center gap-3">
              <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
              <a href={`tel:${customer.phone}`} className="text-[14px] hover:text-[hsl(var(--primary))]">
                {formatPhone(customer.phone)}
              </a>
            </div>
            {customer.email && (
              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                <a href={`mailto:${customer.email}`} className="text-[14px] hover:text-[hsl(var(--primary))] truncate">
                  {customer.email}
                </a>
              </div>
            )}
            {address?.line1 && (
              <div className="flex items-start gap-3 sm:col-span-2">
                <MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                <p className="text-[14px]">
                  {address.line1}
                  {address.line2 ? `, ${address.line2}` : ''} · {address.city}, {address.state} {address.zip}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Service mix */}
        <div className="card-premium p-7">
          <div className="flex items-center gap-2 mb-6">
            <Wrench className="h-[18px] w-[18px] text-muted-foreground/60" />
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Service Mix
            </h3>
          </div>
          {topCategories.length === 0 ? (
            <p className="text-[13px] text-muted-foreground">No jobs yet.</p>
          ) : (
            <div className="space-y-3">
              {topCategories.map(([cat, count]) => {
                const pct = stats.totalJobs > 0 ? (count / stats.totalJobs) * 100 : 0;
                return (
                  <div key={cat}>
                    <div className="flex justify-between text-[12px] mb-1">
                      <span className="capitalize font-medium">{cat}</span>
                      <span className="text-muted-foreground">{count}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full bg-[hsl(var(--primary))] rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Properties */}
      {customer.properties && customer.properties.length > 0 && (
        <div className="card-premium p-7">
          <div className="flex items-center gap-2 mb-6">
            <MapPin className="h-[18px] w-[18px] text-muted-foreground/60" />
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Properties ({customer.properties.length})
            </h3>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {customer.properties.map((prop: any) => (
              <div
                key={prop.id}
                className="rounded-lg border border-border p-4 text-[13px] hover:border-[hsl(var(--primary))]/40 transition-colors"
              >
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 text-[hsl(var(--primary))] shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">
                      {prop.addressLine1}
                      {prop.isPrimary && (
                        <span className="ml-2 text-[10px] uppercase tracking-wider text-[hsl(var(--primary))] font-semibold">
                          Primary
                        </span>
                      )}
                    </p>
                    <p className="text-muted-foreground text-[12px]">
                      {prop.city}, {prop.state} {prop.zip}
                    </p>
                    {prop.accessNotes && (
                      <p className="mt-2 text-[11px] text-amber-700 bg-amber-50 px-2 py-1 rounded">
                        Note: {prop.accessNotes}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Jobs history */}
      {customer.jobs && customer.jobs.length > 0 && (
        <div className="card-premium overflow-hidden">
          <div className="flex items-center justify-between border-b border-border px-7 py-5">
            <div className="flex items-center gap-2">
              <Briefcase className="h-[18px] w-[18px] text-muted-foreground/60" />
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Job History ({customer.jobs.length})
              </h3>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="px-6 py-3 text-left text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Job #</th>
                  <th className="px-6 py-3 text-left text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Category</th>
                  <th className="px-6 py-3 text-left text-[11px] font-medium text-muted-foreground uppercase tracking-wide hidden md:table-cell">Tech</th>
                  <th className="px-6 py-3 text-left text-[11px] font-medium text-muted-foreground uppercase tracking-wide hidden sm:table-cell">Scheduled</th>
                  <th className="px-6 py-3 text-left text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {customer.jobs.map((job: any) => (
                  <tr key={job.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-6 py-3 font-mono text-[12px] font-bold text-[hsl(var(--primary))]">
                      {job.jobNumber}
                    </td>
                    <td className="px-6 py-3 capitalize">{job.category}</td>
                    <td className="px-6 py-3 text-muted-foreground hidden md:table-cell">
                      {job.technician?.user?.fullName ?? <span className="text-[12px]">Unassigned</span>}
                    </td>
                    <td className="px-6 py-3 text-muted-foreground font-mono text-[12px] hidden sm:table-cell">
                      {job.scheduledStart
                        ? new Date(job.scheduledStart).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: '2-digit',
                          })
                        : '—'}
                    </td>
                    <td className="px-6 py-3">
                      <JobStatusBadge status={job.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Invoices history */}
      {customer.invoices && customer.invoices.length > 0 && (
        <div className="card-premium overflow-hidden">
          <div className="flex items-center justify-between border-b border-border px-7 py-5">
            <div className="flex items-center gap-2">
              <Receipt className="h-[18px] w-[18px] text-muted-foreground/60" />
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Invoices ({customer.invoices.length})
              </h3>
            </div>
            <p className="text-[12px] text-muted-foreground">
              {formatCurrency(stats.totalSpent)} of {formatCurrency(stats.totalInvoiced)} paid
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="px-6 py-3 text-left text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Invoice #</th>
                  <th className="px-6 py-3 text-right text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Amount</th>
                  <th className="px-6 py-3 text-right text-[11px] font-medium text-muted-foreground uppercase tracking-wide hidden sm:table-cell">Paid</th>
                  <th className="px-6 py-3 text-left text-[11px] font-medium text-muted-foreground uppercase tracking-wide hidden md:table-cell">Due</th>
                  <th className="px-6 py-3 text-left text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {customer.invoices.map((inv: any) => {
                  const balance = Number(inv.total) - Number(inv.amountPaid);
                  const isOverdue =
                    inv.status !== 'paid' &&
                    new Date(inv.dueDate).getTime() < Date.now() &&
                    balance > 0;
                  return (
                    <tr key={inv.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-6 py-3 font-mono text-[12px] font-bold">{inv.invoiceNumber}</td>
                      <td className="px-6 py-3 text-right font-medium">
                        {formatCurrency(Number(inv.total))}
                      </td>
                      <td className="px-6 py-3 text-right text-muted-foreground hidden sm:table-cell">
                        {formatCurrency(Number(inv.amountPaid))}
                      </td>
                      <td className="px-6 py-3 text-muted-foreground font-mono text-[12px] hidden md:table-cell">
                        {new Date(inv.dueDate).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: '2-digit',
                        })}
                      </td>
                      <td className="px-6 py-3">
                        <InvoiceStatusBadge status={isOverdue ? 'overdue' : inv.status} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Notes */}
      {customer.notes && (
        <div className="card-premium p-7">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground mb-3">
            Notes
          </h3>
          <p className="text-[14px] text-foreground/80 whitespace-pre-wrap leading-relaxed">
            {customer.notes}
          </p>
        </div>
      )}
    </div>
  );
}

// ── Create / Edit Customer Form ────────────────────────────────────────────────

function CustomerForm({
  customerId,
  onClose,
  onSaved,
}: {
  customerId?: string;
  onClose: () => void;
  onSaved: (id: string) => void;
}) {
  const isEditing = !!customerId;
  const utils = api.useUtils();

  // Only query if editing (customerId defined)
  const skipQuery = !isEditing;
  const { data: existing } = api.customer.byId.useQuery(
    { id: customerId ?? 'skip' },
    // @ts-ignore — tRPC v10 quirk: enabled option is valid but types are strict
    { enabled: !skipQuery },
  );

  const createMutation = api.customer.create.useMutation({
    onSuccess: (data) => {
      utils.customer.list.invalidate();
      onSaved(data.id);
    },
  });

  const updateMutation = api.customer.update.useMutation({
    onSuccess: (data) => {
      utils.customer.list.invalidate();
      utils.customer.byId.invalidate({ id: data.id });
      onSaved(data.id);
    },
  });

  const addr = (() => {
    if (!existing?.billingAddress) return { line1: '', city: '', state: '', zip: '' };
    try {
      return typeof existing.billingAddress === 'string'
        ? JSON.parse(existing.billingAddress)
        : existing.billingAddress;
    } catch {
      return { line1: '', city: '', state: '', zip: '' };
    }
  })();

  const [form, setForm] = useState({
    type: existing?.type ?? 'residential',
    billingName: existing?.billingName ?? '',
    companyName: existing?.companyName ?? '',
    email: existing?.email ?? '',
    phone: existing?.phone ?? '',
    addressLine1: addr.line1 ?? '',
    city: addr.city ?? '',
    state: addr.state ?? '',
    zip: addr.zip ?? '',
    source: existing?.source ?? '',
    notes: existing?.notes ?? '',
  });

  // Update form when existing data loads
  const loaded = existing && isEditing;

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((prev) => ({ ...prev, [k]: e.target.value }));

  const isPending = createMutation.isPending || updateMutation.isPending;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      type: form.type as 'residential' | 'commercial',
      billingName: form.billingName,
      companyName: form.companyName || undefined,
      email: form.email || undefined,
      phone: form.phone,
      billingAddress: {
        line1: form.addressLine1,
        city: form.city,
        state: form.state,
        zip: form.zip,
        country: 'US',
      },
      tags: [],
      source: form.source || undefined,
      notes: form.notes || undefined,
    };

    if (isEditing) {
      updateMutation.mutate({ id: customerId!, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-xl bg-background border shadow-xl overflow-y-auto max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h2 className="text-lg font-semibold">
            {isEditing ? 'Edit Customer' : 'New Customer'}
          </h2>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-accent transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Type */}
          <div className="space-y-1.5">
            <Label>Customer Type</Label>
            <select
              value={form.type}
              onChange={set('type')}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="residential">Residential</option>
              <option value="commercial">Commercial</option>
            </select>
          </div>

          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="billingName">
              {form.type === 'commercial' ? 'Contact Name' : 'Full Name'} *
            </Label>
            <Input
              id="billingName"
              value={form.billingName}
              onChange={set('billingName')}
              placeholder="John Martinez"
              required
            />
          </div>

          {/* Company (commercial only) */}
          {form.type === 'commercial' && (
            <div className="space-y-1.5">
              <Label htmlFor="companyName">Company Name</Label>
              <Input
                id="companyName"
                value={form.companyName}
                onChange={set('companyName')}
                placeholder="Sunrise Property Management LLC"
              />
            </div>
          )}

          {/* Phone + Email */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="phone">Phone *</Label>
              <Input
                id="phone"
                value={form.phone}
                onChange={set('phone')}
                placeholder="(305) 555-0100"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={set('email')}
                placeholder="john@example.com"
              />
            </div>
          </div>

          {/* Address */}
          <div className="space-y-3 rounded-lg border p-4">
            <p className="text-sm font-medium">Billing Address</p>
            <Input value={form.addressLine1} onChange={set('addressLine1')} placeholder="Street address" />
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-1">
                <Input value={form.city} onChange={set('city')} placeholder="City" />
              </div>
              <Input value={form.state} onChange={set('state')} placeholder="FL" maxLength={2} className="uppercase" />
              <Input value={form.zip} onChange={set('zip')} placeholder="33131" />
            </div>
          </div>

          {/* Source */}
          <div className="space-y-1.5">
            <Label>Lead Source</Label>
            <select
              value={form.source}
              onChange={set('source')}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">— Unknown —</option>
              <option value="google_lsa">Google LSA</option>
              <option value="thumbtack">Thumbtack</option>
              <option value="yelp">Yelp</option>
              <option value="referral">Referral</option>
              <option value="web_form">Web Form</option>
              <option value="phone">Phone</option>
              <option value="direct">Direct</option>
            </select>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes</Label>
            <textarea
              id="notes"
              value={form.notes}
              onChange={set('notes')}
              rows={3}
              placeholder="Internal notes about this customer..."
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
            />
          </div>

          {/* Error */}
          {(createMutation.error || updateMutation.error) && (
            <p className="text-sm text-destructive">
              {createMutation.error?.message ?? updateMutation.error?.message}
            </p>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? 'Save Changes' : 'Create Customer'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main Customers Page ────────────────────────────────────────────────────────

export default function CustomersPage() {
  return (
    <Suspense fallback={<><Topbar title="Customers" /><div className="p-12 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div></>}>
      <CustomersPageInner />
    </Suspense>
  );
}

function CustomersPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlId = searchParams.get('id');

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'residential' | 'commercial' | undefined>(undefined);
  const [selectedId, setSelectedId] = useState<string | null>(urlId);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | undefined>(undefined);

  // Sync ?id= query param with selectedId (deep-link support)
  useEffect(() => {
    setSelectedId(urlId);
  }, [urlId]);

  function selectCustomer(id: string | null) {
    if (id) router.push(`/customers?id=${id}`);
    else router.push('/customers');
    setSelectedId(id);
  }

  const { data, isLoading } = api.customer.list.useQuery({
    search: search.trim() || undefined,
    type: typeFilter,
    limit: 50,
  });

  const customers = data?.items ?? [];

  function openCreate() {
    setEditingId(undefined);
    setShowForm(true);
  }

  function openEdit(id: string) {
    setEditingId(id);
    setShowForm(true);
  }

  function handleSaved(id: string) {
    setShowForm(false);
    selectCustomer(id);
  }

  if (selectedId) {
    return (
      <>
        <Topbar title="Customers" />
        <CustomerDetail
          customerId={selectedId}
          onBack={() => selectCustomer(null)}
          onEdit={openEdit}
        />
        {showForm && (
          <CustomerForm
            customerId={editingId}
            onClose={() => setShowForm(false)}
            onSaved={handleSaved}
          />
        )}
      </>
    );
  }

  return (
    <>
      <Topbar title="Customers" />

      <div className="p-6 space-y-5">
        {/* Toolbar */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, phone, or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Type filter pills */}
            <div className="flex rounded-lg border divide-x overflow-hidden text-sm">
              {(['all', 'residential', 'commercial'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTypeFilter(t === 'all' ? undefined : t)}
                  className={`px-3 py-2 transition-colors capitalize ${
                    (t === 'all' && !typeFilter) || t === typeFilter
                      ? 'bg-primary text-primary-foreground font-medium'
                      : 'hover:bg-muted text-muted-foreground'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            <Button onClick={openCreate} size="sm">
              <Plus className="h-4 w-4 mr-1.5" />
              New Customer
            </Button>
          </div>
        </div>

        {/* Table */}
        <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center p-16">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : customers.length === 0 ? (
            <div className="p-16 text-center text-muted-foreground">
              <User className="mx-auto h-10 w-10 mb-3 opacity-30" />
              <p className="font-medium">
                {search ? `No customers matching "${search}"` : 'No customers yet'}
              </p>
              {!search && (
                <Button onClick={openCreate} size="sm" className="mt-4">
                  <Plus className="h-4 w-4 mr-1.5" />
                  Add first customer
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Customer</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide hidden sm:table-cell">Phone</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide hidden md:table-cell">City</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Type</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wide hidden lg:table-cell">LTV</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wide">Jobs</th>
                    <th className="px-4 py-3 w-8" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {customers.map((c: any) => {
                    const addr = (() => {
                      try {
                        return typeof c.billingAddress === 'string'
                          ? JSON.parse(c.billingAddress)
                          : c.billingAddress;
                      } catch { return {}; }
                    })();

                    return (
                      <tr
                        key={c.id}
                        className="hover:bg-muted/30 transition-colors cursor-pointer"
                        onClick={() => selectCustomer(c.id)}
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-sm">
                              {c.type === 'commercial'
                                ? <Building2 className="h-4 w-4" />
                                : c.billingName.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-medium">{c.billingName}</p>
                              {c.email && (
                                <p className="text-xs text-muted-foreground">{c.email}</p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-muted-foreground hidden sm:table-cell">
                          {formatPhone(c.phone)}
                        </td>
                        <td className="px-6 py-4 text-muted-foreground hidden md:table-cell">
                          {addr?.city ?? '—'}
                        </td>
                        <td className="px-6 py-4">
                          <CustomerTypeBadge type={c.type} />
                        </td>
                        <td className="px-6 py-4 text-right font-medium hidden lg:table-cell">
                          {Number(c.lifetimeValue) > 0
                            ? formatCurrency(Number(c.lifetimeValue))
                            : <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-muted text-xs font-medium">
                            {c._count?.jobs ?? 0}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-muted-foreground">
                          <ChevronRight className="h-4 w-4" />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Summary */}
        {!isLoading && customers.length > 0 && (
          <p className="text-xs text-muted-foreground">
            {customers.length} customer{customers.length !== 1 ? 's' : ''}
            {search && ` matching "${search}"`}
          </p>
        )}
      </div>

      {/* Create/Edit modal */}
      {showForm && (
        <CustomerForm
          customerId={editingId}
          onClose={() => setShowForm(false)}
          onSaved={handleSaved}
        />
      )}
    </>
  );
}
