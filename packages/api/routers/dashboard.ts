import { z } from 'zod';
import { protectedProcedure, router } from '../trpc';

// Job stages shown on the Jobs page (mirrors JOB_STAGES in jobs/page.tsx)
const JOB_STAGE_LIST = [
  'job_created',
  'scheduled',
  'on_the_way',
  'in_progress',
  'done',
  'invoiced',
  'paid',
] as const;

// Lead stages shown on the Leads page
const LEAD_STAGE_LIST = [
  'new_lead',
  'ai_responding',
  'qualified',
  'estimate_sent',
  'estimate_approved',
] as const;

export const dashboardRouter = router({
  stats: protectedProcedure
    .input(
      z.object({
        from: z.date().optional(),
        to: z.date().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const now = new Date();
      const from = input.from ?? new Date(now.getFullYear(), now.getMonth(), 1);
      const to = input.to ?? now;

      const [
        openInvoicesResult,
        oppByStage,
        recentOpps,
      ] = await Promise.all([
        // Outstanding invoices — still from Invoice table (not migrated yet)
        ctx.db.invoice.aggregate({
          where: {
            orgId: ctx.orgId!,
            status: { in: ['sent', 'partial', 'overdue'] },
          },
          _sum: { total: true, amountPaid: true },
          _count: true,
        }),

        // Opportunity counts by stage (replaces separate job + lead counts)
        ctx.db.opportunity.groupBy({
          by: ['stage'],
          where: { orgId: ctx.orgId! },
          _count: { id: true },
        }),

        // Recent active opportunities (job stages)
        ctx.db.opportunity.findMany({
          where: {
            orgId: ctx.orgId!,
            stage: { in: [...JOB_STAGE_LIST, 'lost'] as string[], notIn: ['paid', 'lost'] },
          },
          include: {
            customer: { select: { billingName: true } },
            technician: { include: { user: { select: { fullName: true } } } },
          },
          orderBy: { lastActivityAt: 'desc' },
          take: 5,
        }),
      ]);

      const totalOwed = Number(openInvoicesResult._sum.total ?? 0);
      const totalPaid = Number(openInvoicesResult._sum.amountPaid ?? 0);

      // Build stage map
      const byStage: Record<string, number> = Object.fromEntries(
        oppByStage.map((g) => [g.stage, g._count.id]),
      );

      // Aggregate counts for dashboard cards
      const totalJobStageOpps = JOB_STAGE_LIST.reduce((s, st) => s + (byStage[st] ?? 0), 0);
      const newLeads = byStage['new_lead'] ?? 0;
      const activeJobOpps =
        (byStage['job_created'] ?? 0) +
        (byStage['scheduled'] ?? 0) +
        (byStage['on_the_way'] ?? 0) +
        (byStage['in_progress'] ?? 0);

      return {
        // Legacy-compatible fields used by existing dashboard UI
        totalJobs: totalJobStageOpps,
        newLeads,
        openInvoices: {
          count: openInvoicesResult._count,
          outstanding: totalOwed - totalPaid,
        },
        // Recent jobs now from Opportunity
        recentJobs: recentOpps.map((o) => ({
          id: o.id,
          // jobNumber not on Opportunity until job stage — use opp id prefix
          jobNumber: o.jobNumber ?? `OPP-${o.id.slice(0, 6).toUpperCase()}`,
          customer: o.customer ?? { billingName: o.customerName },
          technician: o.technician,
          scheduledStart: o.scheduledStart,
          status: o.stage,
        })),
        // Opportunity stage breakdown (new field — used by updated dashboard)
        oppByStage: byStage,
        activeJobOpps,
      };
    }),
});
