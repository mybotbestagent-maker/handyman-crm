/**
 * Shared status badge components used across Customers, Leads, Jobs pages.
 */

// ── Job Status ────────────────────────────────────────────────────────────────

const JOB_STATUS_STYLES: Record<string, string> = {
  new:         'bg-blue-50 text-blue-700 border-blue-200',
  scheduled:   'bg-purple-50 text-purple-700 border-purple-200',
  dispatched:  'bg-yellow-50 text-yellow-700 border-yellow-200',
  en_route:    'bg-orange-50 text-orange-700 border-orange-200',
  on_site:     'bg-amber-50 text-amber-700 border-amber-200',
  in_progress: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  completed:   'bg-green-50 text-green-700 border-green-200',
  invoiced:    'bg-cyan-50 text-cyan-700 border-cyan-200',
  paid:        'bg-emerald-50 text-emerald-700 border-emerald-200',
  closed:      'bg-gray-100 text-gray-500 border-gray-200',
  canceled:    'bg-red-50 text-red-500 border-red-200',
};

export function JobStatusBadge({ status }: { status: string }) {
  const cls = JOB_STATUS_STYLES[status] ?? 'bg-gray-100 text-gray-600 border-gray-200';
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${cls}`}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}

// ── Lead Status ───────────────────────────────────────────────────────────────

const LEAD_STATUS_STYLES: Record<string, string> = {
  new:       'bg-blue-50 text-blue-700 border-blue-200',
  contacted: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  qualified: 'bg-purple-50 text-purple-700 border-purple-200',
  converted: 'bg-green-50 text-green-700 border-green-200',
  dead:      'bg-gray-100 text-gray-500 border-gray-200',
};

export function LeadStatusBadge({ status }: { status: string }) {
  const cls = LEAD_STATUS_STYLES[status] ?? 'bg-gray-100 text-gray-600 border-gray-200';
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${cls}`}>
      {status}
    </span>
  );
}

// ── Priority Badge ────────────────────────────────────────────────────────────

const PRIORITY_STYLES: Record<string, string> = {
  low:       'bg-gray-50 text-gray-500 border-gray-200',
  normal:    'bg-slate-50 text-slate-600 border-slate-200',
  high:      'bg-orange-50 text-orange-700 border-orange-200',
  emergency: 'bg-red-50 text-red-700 border-red-200',
};

export function PriorityBadge({ priority }: { priority: string }) {
  const cls = PRIORITY_STYLES[priority] ?? 'bg-gray-100 text-gray-600 border-gray-200';
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${cls}`}>
      {priority}
    </span>
  );
}

// ── Customer Type Badge ───────────────────────────────────────────────────────

export function CustomerTypeBadge({ type }: { type: string }) {
  const cls =
    type === 'commercial'
      ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
      : 'bg-slate-50 text-slate-600 border-slate-200';
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${cls}`}>
      {type}
    </span>
  );
}

// ── Invoice Status Badge ──────────────────────────────────────────────────────

const INVOICE_STATUS_STYLES: Record<string, string> = {
  draft:   'bg-gray-100 text-gray-600 border-gray-200',
  sent:    'bg-blue-50 text-blue-700 border-blue-200',
  partial: 'bg-amber-50 text-amber-700 border-amber-200',
  paid:    'bg-emerald-50 text-emerald-700 border-emerald-200',
  overdue: 'bg-red-50 text-red-700 border-red-200',
  voided:  'bg-gray-100 text-gray-400 border-gray-200 line-through',
};

export function InvoiceStatusBadge({ status }: { status: string }) {
  const cls = INVOICE_STATUS_STYLES[status] ?? 'bg-gray-100 text-gray-600 border-gray-200';
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${cls}`}>
      {status}
    </span>
  );
}
