/**
 * Business rules — single source of truth for derived metrics.
 *
 * Used by: tRPC routers (customer, dashboard, reports), future Midas Copilot
 * (suggestion engine reads the same rules to generate proactive nudges).
 *
 * Rule of thumb: if a metric appears in two UI surfaces, the formula lives here.
 */

// ── Invoice / Customer financial rules ──────────────────────────────────────

type InvoiceLike = {
  status: string;
  total: number;
  amountPaid: number;
  dueDate: Date;
};

export function isInvoiceOverdue(inv: InvoiceLike, now = new Date()): boolean {
  if (inv.status === 'paid' || inv.status === 'voided') return false;
  const balance = Number(inv.total) - Number(inv.amountPaid);
  return balance > 0 && inv.dueDate.getTime() < now.getTime();
}

export function invoiceBalance(inv: InvoiceLike): number {
  return Math.max(Number(inv.total) - Number(inv.amountPaid), 0);
}

export function summarizeInvoices(invoices: InvoiceLike[], now = new Date()) {
  const active = invoices.filter((i) => i.status !== 'voided');
  return {
    invoiceCount: active.length,
    totalInvoiced: active.reduce((s, i) => s + Number(i.total), 0),
    totalSpent: active.reduce((s, i) => s + Number(i.amountPaid), 0),
    outstandingBalance: active.reduce((s, i) => s + invoiceBalance(i), 0),
    overdueCount: active.filter((i) => isInvoiceOverdue(i, now)).length,
  };
}

// ── Job financial rules ──────────────────────────────────────────────────────

type JobItemLike = {
  itemType: string; // labor | part | service | discount
  qty: number;
  unitPrice: number;
};

type JobLike = {
  estimatedRevenue: number | null;
  actualRevenue: number | null;
  laborCost: number | null;
  partsCost: number | null;
  actualStart: Date | null;
  actualEnd: Date | null;
  scheduledStart: Date | null;
  scheduledEnd: Date | null;
  status: string;
  items?: JobItemLike[];
};

/** Compute revenue, costs, and profit estimate for a job. */
export function jobFinancials(job: JobLike) {
  const revenue = Number(job.actualRevenue ?? job.estimatedRevenue ?? 0);

  // Prefer denormalized labor/parts cost; fall back to summing items
  let labor = Number(job.laborCost ?? 0);
  let parts = Number(job.partsCost ?? 0);
  if ((!labor || !parts) && job.items) {
    if (!labor) labor = job.items.filter((i) => i.itemType === 'labor').reduce((s, i) => s + i.qty * i.unitPrice, 0);
    if (!parts) parts = job.items.filter((i) => i.itemType === 'part').reduce((s, i) => s + i.qty * i.unitPrice, 0);
  }

  const profit = revenue - labor - parts;
  const margin = revenue > 0 ? profit / revenue : 0;
  return { revenue, labor, parts, profit, margin };
}

/** Time spent on site (actualStart → actualEnd or now if in_progress). */
export function jobTimeOnSiteMinutes(job: JobLike, now = new Date()): number | null {
  if (!job.actualStart) return null;
  const end = job.actualEnd ?? (job.status === 'in_progress' ? now : null);
  if (!end) return null;
  return Math.max(0, Math.round((end.getTime() - job.actualStart.getTime()) / 60000));
}

/** Did the job overrun its scheduled window? (positive = overrun, negative = early) */
export function jobScheduleVarianceMinutes(job: JobLike, now = new Date()): number | null {
  if (!job.scheduledEnd) return null;
  const actualEnd = job.actualEnd ?? (job.status === 'in_progress' ? now : null);
  if (!actualEnd) return null;
  return Math.round((actualEnd.getTime() - job.scheduledEnd.getTime()) / 60000);
}

// ── Suggestion-engine seeds (used by future Midas Copilot) ───────────────────

type SuggestionContext = {
  invoices?: InvoiceLike[];
  jobs?: JobLike[];
  now?: Date;
};

/**
 * Generate proactive suggestions for a customer/job context.
 * Returns lightweight messages — Midas decides delivery (SMS, email, dashboard nudge).
 */
export function generateSuggestions(ctx: SuggestionContext): string[] {
  const out: string[] = [];
  const now = ctx.now ?? new Date();

  if (ctx.invoices?.length) {
    const sum = summarizeInvoices(ctx.invoices, now);
    if (sum.overdueCount > 0) {
      out.push(`Customer has ${sum.overdueCount} overdue invoice(s). Send payment reminder.`);
    }
    if (sum.outstandingBalance > 5000) {
      out.push(`Outstanding balance over $5K — consider holding new jobs until paid.`);
    }
  }

  if (ctx.jobs?.length) {
    const overrunning = ctx.jobs.filter((j) => {
      const v = jobScheduleVarianceMinutes(j, now);
      return v !== null && v > 30 && j.status === 'in_progress';
    });
    if (overrunning.length > 0) {
      out.push(`${overrunning.length} job(s) running 30+ min over schedule — notify next customer.`);
    }
  }

  return out;
}
