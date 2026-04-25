/**
 * Opportunity stage machine — single source of truth.
 *
 * Used by opportunity router (transition validation) and the future
 * Midas Copilot (suggestion engine reads transition graph to plan AI actions).
 */

export const OPP_STAGES = [
  'new_lead',
  'ai_responding',
  'qualified',
  'estimate_sent',
  'estimate_approved',
  'job_created',
  'scheduled',
  'on_the_way',
  'in_progress',
  'done',
  'invoiced',
  'paid',
  'lost',
] as const;

export type OppStage = (typeof OPP_STAGES)[number];

export const LEAD_STAGES: OppStage[] = [
  'new_lead', 'ai_responding', 'qualified', 'estimate_sent', 'estimate_approved',
];
export const JOB_STAGES: OppStage[] = [
  'job_created', 'scheduled', 'on_the_way', 'in_progress', 'done', 'invoiced', 'paid',
];
export const ACTIVE_STAGES: OppStage[] = [...LEAD_STAGES, ...JOB_STAGES];
export const TERMINAL_STAGES: OppStage[] = ['paid', 'lost'];

export const LOST_REASONS = [
  'no_response',
  'declined',
  'won_by_competitor',
  'canceled',
  'duplicate',
  'lost', // generic fallback (what we used for lead.status='dead' backfill)
] as const;
export type LostReason = (typeof LOST_REASONS)[number];

/**
 * Allowed forward transitions per stage. Anything to 'lost' is always allowed.
 * Backward transitions blocked except 'lost' → 'new_lead' (re-engage).
 */
export const STAGE_TRANSITIONS: Record<OppStage, OppStage[]> = {
  new_lead:          ['ai_responding', 'qualified', 'lost'],
  ai_responding:     ['qualified', 'lost'],
  qualified:         ['estimate_sent', 'job_created', 'lost'],
  estimate_sent:     ['estimate_approved', 'lost'],
  estimate_approved: ['job_created', 'lost'],
  job_created:       ['scheduled', 'lost'],
  scheduled:         ['on_the_way', 'in_progress', 'lost'],
  on_the_way:        ['in_progress', 'lost'],
  in_progress:       ['done', 'lost'],
  done:              ['invoiced', 'lost'],
  invoiced:          ['paid', 'lost'],
  paid:              [], // terminal
  lost:              ['new_lead'], // re-engage
};

export function canTransition(from: OppStage, to: OppStage): boolean {
  return STAGE_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Append a transition event to the JSON history string.
 */
export function appendStageHistory(
  existingHistory: string,
  event: { stage: OppStage; enteredAt: Date; by: string; lostReason?: string },
): string {
  let arr: any[] = [];
  try {
    arr = JSON.parse(existingHistory || '[]');
  } catch {
    arr = [];
  }
  // mark previous entry's exitedAt + durationMs
  if (arr.length > 0) {
    const last = arr[arr.length - 1];
    if (!last.exitedAt) {
      last.exitedAt = event.enteredAt.toISOString();
      last.durationMs = event.enteredAt.getTime() - new Date(last.enteredAt).getTime();
    }
  }
  arr.push({
    stage: event.stage,
    enteredAt: event.enteredAt.toISOString(),
    by: event.by,
    ...(event.lostReason && { lostReason: event.lostReason }),
  });
  return JSON.stringify(arr);
}

/**
 * Map an Opportunity stage to a user-facing label (for UI badges).
 */
export const STAGE_LABELS: Record<OppStage, string> = {
  new_lead: 'New lead',
  ai_responding: 'AI responding',
  qualified: 'Qualified',
  estimate_sent: 'Estimate sent',
  estimate_approved: 'Estimate approved',
  job_created: 'Job created',
  scheduled: 'Scheduled',
  on_the_way: 'On the way',
  in_progress: 'In progress',
  done: 'Done',
  invoiced: 'Invoiced',
  paid: 'Paid',
  lost: 'Lost',
};

/**
 * Stage-derived timestamp field name. When transitioning to a stage that has a
 * dedicated `*At` column on Opportunity, set it on the update payload.
 */
export const STAGE_TIMESTAMP_FIELD: Partial<Record<OppStage, string>> = {
  qualified: 'qualifiedAt',
  job_created: 'jobCreatedAt',
  scheduled: 'scheduledAt',
  done: 'doneAt',
  paid: 'paidAt',
  lost: 'lostAt',
};
