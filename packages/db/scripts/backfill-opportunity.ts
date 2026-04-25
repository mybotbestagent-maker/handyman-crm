/**
 * T-CORE-OPPORTUNITY backfill (D-03 / Plan §6 Step 2)
 *
 * Strategy: Shadow table.
 *  1. Create Opportunity from each Job (JOB_CREATED+ stages); take createdAt
 *     from the linked Lead if present (preserves first-touch timestamp).
 *  2. Create Opportunity from each unconverted Lead (NEW_LEAD..QUALIFIED stages).
 *  3. Backfill opportunityId on Invoice / Estimate / JobItem / Call via
 *     legacy id pivot.
 *
 * Idempotent: skip if opportunities already exist for legacyJobId / legacyLeadId.
 *
 * Run: pnpm tsx scripts/backfill-opportunity.ts            (dry-run, prints plan)
 *      pnpm tsx scripts/backfill-opportunity.ts --apply    (writes to DB)
 */
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();
const APPLY = process.argv.includes('--apply');

// ─── Status → Stage mapping ─────────────────────────────────────────────────

function mapLeadStatusToStage(status: string | null | undefined): {
  stage: string;
  lostReason?: string;
} {
  switch (status) {
    case null:
    case undefined:
    case '':
    case 'new':
    case 'new_lead':
    case '1st_contact_attempt':
      return { stage: 'new_lead' };
    case 'contacted':
      return { stage: 'ai_responding' };
    case 'qualified':
    case '2nd_contact':
      return { stage: 'qualified' };
    case '3rd_contact':
    case 'cold':
      return { stage: 'lost', lostReason: 'no_response' };
    case 'dead':
      // Pre-flight finding (Farrukh-confirmed): Lead.status='dead' = LOST/lost
      return { stage: 'lost', lostReason: 'lost' };
    case 'lost':
    case 'declined':
      return { stage: 'lost', lostReason: 'declined' };
    case 'converted':
    case 'converted_to_job':
      // Normally these are skipped (the linked Job becomes the Opportunity).
      // Orphan case: lead.status='converted' but no Job points back (data
      // drift from old Workiz import or manual deletion). Treat as
      // 'qualified' — preserves the historical record without losing it.
      return { stage: 'qualified' };
    default:
      throw new Error(`UNMAPPED Lead.status='${status}' — STOP, ask Farrukh`);
  }
}

function mapJobStatusToStage(status: string): {
  stage: string;
  lostReason?: string;
} {
  switch (status) {
    case 'new':
      // Pre-flight finding (Farrukh-confirmed): Job.status='new' = JOB_CREATED
      return { stage: 'job_created' };
    case 'submitted':
    case 'pending':
      return { stage: 'job_created' };
    case 'scheduled':
      return { stage: 'scheduled' };
    case 'dispatched':
      // Pre-flight finding (Farrukh-confirmed): tech assigned, awaiting departure = SCHEDULED
      return { stage: 'scheduled' };
    case 'on_the_way':
    case 'en_route':
      return { stage: 'on_the_way' };
    case 'on_site':
    case 'in_progress':
      return { stage: 'in_progress' };
    case 'done_pending_approval':
    case 'done':
    case 'completed':
      return { stage: 'done' };
    case 'invoiced':
      return { stage: 'invoiced' };
    case 'paid':
    case 'closed':
      return { stage: 'paid' };
    case 'canceled':
    case 'cancelled':
      return { stage: 'lost', lostReason: 'canceled' };
    default:
      throw new Error(`UNMAPPED Job.status='${status}' — STOP, ask Farrukh`);
  }
}

// ─── Address parser (Customer.billingAddress is JSON string) ────────────────

function parseAddress(json: string | null | undefined): {
  line1?: string;
  city?: string;
  state?: string;
  zip?: string;
} {
  if (!json) return {};
  try {
    const a = typeof json === 'string' ? JSON.parse(json) : json;
    return { line1: a.line1, city: a.city, state: a.state, zip: a.zip };
  } catch {
    return {};
  }
}

// ─── Stage-derived timestamps ──────────────────────────────────────────────

function stageTimestamps(stage: string, baseDate: Date) {
  // Set the appropriate "*At" timestamps for stages the opportunity has reached.
  // Heuristic: assume linear progression, all transitions at baseDate
  // (cleaner than null since we can't reconstruct true history from current state).
  const ts: Record<string, Date | null> = {
    qualifiedAt: null,
    jobCreatedAt: null,
    scheduledAt: null,
    doneAt: null,
    paidAt: null,
    lostAt: null,
  };

  const reached = (s: string) => {
    const order = ['new_lead', 'ai_responding', 'qualified', 'estimate_sent', 'estimate_approved',
                   'job_created', 'scheduled', 'on_the_way', 'in_progress', 'done', 'invoiced', 'paid'];
    return order.indexOf(stage) >= order.indexOf(s);
  };

  if (reached('qualified')) ts.qualifiedAt = baseDate;
  if (reached('job_created')) ts.jobCreatedAt = baseDate;
  if (reached('scheduled')) ts.scheduledAt = baseDate;
  if (reached('done')) ts.doneAt = baseDate;
  if (reached('paid')) ts.paidAt = baseDate;
  if (stage === 'lost') ts.lostAt = baseDate;

  return ts;
}

// ─── Main backfill ──────────────────────────────────────────────────────────

async function main() {
  const orgs = await db.organization.findMany();
  if (orgs.length === 0) {
    console.error('no organizations — abort');
    process.exit(1);
  }

  console.log(`mode: ${APPLY ? 'APPLY' : 'DRY-RUN'}`);
  console.log(`organizations: ${orgs.length}`);

  let opportunitiesCreated = 0;
  let leadOnly = 0;
  let jobBased = 0;
  let opportunityItemsCreated = 0;
  let invoiceLinks = 0;
  let estimateLinks = 0;
  let jobItemLinks = 0;
  let callLinks = 0;
  const stageDistribution: Record<string, number> = {};
  const errors: string[] = [];

  for (const org of orgs) {
    console.log(`\n=== org ${org.slug} (${org.id}) ===`);

    // 0. Idempotency — skip if opportunities already exist for this org
    const existing = await db.opportunity.count({ where: { orgId: org.id } });
    if (existing > 0) {
      console.log(`  ! ${existing} opportunities already exist — skipping org`);
      continue;
    }

    // 1. Pull jobs with linked lead (or null) and customer
    const jobs = await db.job.findMany({
      where: { orgId: org.id },
      include: { lead: true, customer: true, items: true },
    });
    console.log(`  jobs: ${jobs.length}`);

    // Track which leadIds are claimed by jobs (to skip them in step 2)
    const claimedLeadIds = new Set<string>();

    // 1a. Create Opportunity from each job
    for (const job of jobs) {
      try {
        const { stage, lostReason } = mapJobStatusToStage(job.status);
        stageDistribution[stage] = (stageDistribution[stage] ?? 0) + 1;

        // First-touch timestamp = lead.receivedAt if linked, else job.createdAt
        const firstTouch = job.lead?.receivedAt ?? job.createdAt;
        const stageTs = stageTimestamps(stage, job.updatedAt);
        const addr = parseAddress(job.customer.billingAddress);

        const data = {
          orgId: org.id,
          stage,
          lostReason,
          stageHistory: JSON.stringify([
            { stage: 'new_lead', enteredAt: firstTouch, by: 'backfill' },
            { stage, enteredAt: job.updatedAt, by: 'backfill' },
          ]),
          sourceId: job.lead?.source ?? job.customer.source ?? 'direct',
          sourceLeadId: job.leadId ?? null,
          customerId: job.customerId,
          customerName: job.customer.billingName,
          customerPhone: job.customer.phone,
          customerEmail: job.customer.email,
          serviceCategory: job.category,
          description: job.description,
          addressLine: addr.line1 ?? null,
          city: addr.city ?? null,
          state: addr.state ?? null,
          zip: addr.zip ?? null,
          jobNumber: job.jobNumber,
          propertyId: job.propertyId,
          scheduledStart: job.scheduledStart,
          scheduledEnd: job.scheduledEnd,
          durationEstimateMinutes: job.durationEstimateMinutes,
          technicianId: job.assignedTechnicianId,
          dispatcherId: job.dispatcherId,
          actualStart: job.actualStart,
          actualEnd: job.actualEnd,
          estimateAmount: job.estimatedRevenue,
          finalAmount: job.actualRevenue,
          laborCost: job.laborCost,
          partsCost: job.partsCost,
          customerRating: job.customerRating,
          customerReview: job.customerReview,
          internalNotes: job.internalNotes,
          priority: job.priority,
          ...stageTs,
          enteredCurrentStageAt: job.updatedAt,
          createdAt: firstTouch,
          legacyLeadId: job.leadId,
          legacyJobId: job.id,
        };

        if (APPLY) {
          const opp = await db.opportunity.create({ data });
          // Link items
          for (const item of job.items) {
            await db.jobItem.update({
              where: { id: item.id },
              data: { opportunityId: opp.id },
            });
            await db.opportunityItem.create({
              data: {
                orgId: org.id,
                opportunityId: opp.id,
                itemType: item.itemType,
                name: item.name,
                qty: item.qty,
                unitPrice: item.unitPrice,
                total: item.total,
                sortOrder: item.sortOrder,
              },
            });
            opportunityItemsCreated++;
            jobItemLinks++;
          }
        }
        opportunitiesCreated++;
        jobBased++;
        if (job.leadId) claimedLeadIds.add(job.leadId);
      } catch (e: any) {
        errors.push(`job ${job.jobNumber}: ${e.message}`);
      }
    }

    // 2. Create Opportunity from each unclaimed Lead
    const leads = await db.lead.findMany({
      where: { orgId: org.id, id: { notIn: Array.from(claimedLeadIds) } },
      include: { customer: true },
    });
    console.log(`  unclaimed leads: ${leads.length}`);

    for (const lead of leads) {
      try {
        const { stage, lostReason } = mapLeadStatusToStage(lead.status);
        stageDistribution[stage] = (stageDistribution[stage] ?? 0) + 1;

        const stageTs = stageTimestamps(stage, lead.receivedAt);
        const addr = parseAddress(lead.customer?.billingAddress);

        const data = {
          orgId: org.id,
          stage,
          lostReason,
          stageHistory: JSON.stringify([
            { stage: 'new_lead', enteredAt: lead.receivedAt, by: 'backfill' },
            ...(stage !== 'new_lead' ? [{ stage, enteredAt: lead.receivedAt, by: 'backfill' }] : []),
          ]),
          sourceId: lead.source,
          sourceLeadId: null,
          customerId: lead.customerId,
          customerName: lead.customer?.billingName ?? '(unknown lead contact)',
          customerPhone: lead.customer?.phone ?? null,
          customerEmail: lead.customer?.email ?? null,
          serviceCategory: lead.serviceType,
          description: lead.description,
          addressLine: addr.line1 ?? null,
          city: addr.city ?? null,
          state: addr.state ?? null,
          zip: addr.zip ?? null,
          ...stageTs,
          enteredCurrentStageAt: lead.receivedAt,
          createdAt: lead.receivedAt,
          legacyLeadId: lead.id,
          legacyJobId: null,
        };

        if (APPLY) {
          await db.opportunity.create({ data });
        }
        opportunitiesCreated++;
        leadOnly++;
      } catch (e: any) {
        errors.push(`lead ${lead.id}: ${e.message}`);
      }
    }

    // 3. Backfill FK on dependent tables (Invoice, Estimate, Call)
    if (APPLY) {
      // Invoice — match by jobId
      const invoices = await db.invoice.findMany({ where: { orgId: org.id } });
      for (const inv of invoices) {
        const opp = await db.opportunity.findFirst({ where: { legacyJobId: inv.jobId } });
        if (opp) {
          await db.invoice.update({ where: { id: inv.id }, data: { opportunityId: opp.id } });
          invoiceLinks++;
        }
      }

      // Estimate — match by jobId
      const estimates = await db.estimate.findMany({ where: { orgId: org.id } });
      for (const est of estimates) {
        const opp = await db.opportunity.findFirst({ where: { legacyJobId: est.jobId } });
        if (opp) {
          await db.estimate.update({ where: { id: est.id }, data: { opportunityId: opp.id } });
          estimateLinks++;
        }
      }

      // Call — match by jobId or leadId
      const calls = await db.call.findMany({ where: { orgId: org.id } });
      for (const call of calls) {
        let opp = null;
        if (call.jobId) opp = await db.opportunity.findFirst({ where: { legacyJobId: call.jobId } });
        if (!opp && call.leadId) opp = await db.opportunity.findFirst({ where: { legacyLeadId: call.leadId } });
        if (opp) {
          await db.call.update({ where: { id: call.id }, data: { opportunityId: opp.id } });
          callLinks++;
        }
      }
    }
  }

  // ─── Report ─────────────────────────────────────────────────────────────
  console.log('\n══════════════════════════════════════════');
  console.log(`mode: ${APPLY ? 'APPLY' : 'DRY-RUN'}`);
  console.log(`opportunities created: ${opportunitiesCreated}`);
  console.log(`  ├ from jobs:  ${jobBased}`);
  console.log(`  └ from leads: ${leadOnly}`);
  console.log(`opportunity_items created: ${opportunityItemsCreated}`);
  console.log(`FK backfills:`);
  console.log(`  ├ invoices linked:  ${invoiceLinks}`);
  console.log(`  ├ estimates linked: ${estimateLinks}`);
  console.log(`  ├ job_items linked: ${jobItemLinks}`);
  console.log(`  └ calls linked:     ${callLinks}`);
  console.log('\nstage distribution:');
  Object.entries(stageDistribution)
    .sort(([, a], [, b]) => b - a)
    .forEach(([s, n]) => console.log(`  ${s.padEnd(20)} ${n}`));
  if (errors.length > 0) {
    console.log(`\n!!! ${errors.length} ERRORS:`);
    errors.forEach((e) => console.log(`  ${e}`));
    process.exit(1);
  }
  if (!APPLY) {
    console.log('\n(dry-run — re-run with --apply to write changes)');
  }
}

main()
  .catch((e) => {
    console.error('FATAL:', e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
