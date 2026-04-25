/**
 * T-CORE-OPPORTUNITY router (Plan §6 Step 4).
 *
 * Shadow router — old jobRouter and leadRouter remain operational.
 * UI screens cut over one at a time once Farrukh approves (Plan §6 Step 5).
 */
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { protectedProcedure, router, requireRoles, writeAudit } from '../trpc';
import {
  OPP_STAGES,
  LEAD_STAGES,
  JOB_STAGES,
  ACTIVE_STAGES,
  TERMINAL_STAGES,
  LOST_REASONS,
  STAGE_TIMESTAMP_FIELD,
  canTransition,
  appendStageHistory,
} from '../lib/opportunity-stages';
import { summarizeInvoices, jobFinancials, jobTimeOnSiteMinutes } from '../lib/business-rules';

const stageSchema = z.enum(OPP_STAGES);
const lostReasonSchema = z.enum(LOST_REASONS);

export const opportunityRouter = router({
  /**
   * Filtered list. Tech sees only own assigned (same scope rule as job.list).
   * Defaults to active stages; pass [] to include lost.
   */
  list: protectedProcedure
    .input(
      z.object({
        stages: z.array(stageSchema).optional(),
        sourceId: z.string().optional(),
        technicianId: z.string().optional(),
        customerId: z.string().optional(),
        unassignedOnly: z.boolean().optional(),
        from: z.date().optional(),
        to: z.date().optional(),
        limit: z.number().min(1).max(100).default(50),
        cursor: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      // Tech scope: only own assigned (sentinel for missing tech profile)
      let techScope: string | undefined;
      if (ctx.session!.user.role === 'tech') {
        const tech = await ctx.db.technician.findUnique({
          where: { userId: ctx.session!.user.id },
        });
        techScope = tech?.id ?? '__no_tech__';
      }

      const items = await ctx.db.opportunity.findMany({
        where: {
          orgId: ctx.orgId!,
          ...(input.stages && input.stages.length > 0 && { stage: { in: input.stages } }),
          ...(input.sourceId && { sourceId: input.sourceId }),
          ...(techScope
            ? { technicianId: techScope }
            : {
                ...(input.technicianId && { technicianId: input.technicianId }),
                ...(input.unassignedOnly && { technicianId: null }),
              }),
          ...(input.customerId && { customerId: input.customerId }),
          ...(input.from || input.to
            ? {
                lastActivityAt: {
                  ...(input.from && { gte: input.from }),
                  ...(input.to && { lte: input.to }),
                },
              }
            : {}),
        },
        include: {
          customer: { select: { id: true, billingName: true, phone: true } },
          property: { select: { id: true, addressLine1: true, city: true, state: true } },
          technician: { include: { user: { select: { fullName: true, avatarUrl: true } } } },
          _count: { select: { items: true, invoices: true, estimates: true } },
        },
        take: input.limit + 1,
        ...(input.cursor && { cursor: { id: input.cursor }, skip: 1 }),
        orderBy: [{ lastActivityAt: 'desc' }],
      });

      const hasMore = items.length > input.limit;
      return {
        items: hasMore ? items.slice(0, -1) : items,
        nextCursor: hasMore ? items[items.length - 2]?.id : undefined,
      };
    }),

  byId: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      let techScope: string | undefined;
      if (ctx.session!.user.role === 'tech') {
        const tech = await ctx.db.technician.findUnique({
          where: { userId: ctx.session!.user.id },
        });
        techScope = tech?.id ?? '__no_tech__';
      }

      const opp = await ctx.db.opportunity.findFirst({
        where: {
          id: input.id,
          orgId: ctx.orgId!,
          ...(techScope && { technicianId: techScope }),
        },
        include: {
          customer: true,
          property: true,
          technician: { include: { user: true } },
          items: { orderBy: { sortOrder: 'asc' } },
          invoices: { include: { payments: true } },
          estimates: true,
          calls: { orderBy: { startedAt: 'desc' }, take: 5 },
        },
      });
      if (!opp) throw new TRPCError({ code: 'NOT_FOUND' });

      // Smart fields: reuse job-level financial helpers
      const proxyJob = {
        estimatedRevenue: opp.estimateAmount,
        actualRevenue: opp.finalAmount,
        laborCost: opp.laborCost,
        partsCost: opp.partsCost,
        actualStart: opp.actualStart,
        actualEnd: opp.actualEnd,
        scheduledStart: opp.scheduledStart,
        scheduledEnd: opp.scheduledEnd,
        status: opp.stage,
        items: opp.items.map((i) => ({
          itemType: i.itemType,
          qty: i.qty,
          unitPrice: i.unitPrice,
        })),
      };
      const financials = jobFinancials(proxyJob as any);
      const timeOnSiteMinutes = jobTimeOnSiteMinutes(proxyJob as any);
      const invoiceSummary = summarizeInvoices(opp.invoices);

      let parsedHistory: any[] = [];
      try {
        parsedHistory = JSON.parse(opp.stageHistory || '[]');
      } catch {
        parsedHistory = [];
      }

      return {
        ...opp,
        smart: {
          ...financials,
          timeOnSiteMinutes,
          invoiceSummary,
          stageHistory: parsedHistory,
          isLeadStage: LEAD_STAGES.includes(opp.stage as any),
          isJobStage: JOB_STAGES.includes(opp.stage as any),
          isTerminal: TERMINAL_STAGES.includes(opp.stage as any),
        },
      };
    }),

  /**
   * Create from intake (typically AI webhook or dispatcher). Defaults to NEW_LEAD.
   */
  create: requireRoles(['admin', 'dispatcher'])
    .input(
      z.object({
        sourceId: z.string(),
        sourceLeadId: z.string().optional(),
        serviceCategory: z.string(),
        description: z.string().optional(),
        customerName: z.string().min(1),
        customerPhone: z.string().optional(),
        customerEmail: z.string().email().optional(),
        addressLine: z.string().optional(),
        city: z.string().optional(),
        state: z.string().optional(),
        zip: z.string().optional(),
        priority: z.enum(['low', 'normal', 'high', 'emergency']).default('normal'),
        initialStage: stageSchema.default('new_lead'),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const now = new Date();
      const stageHistory = appendStageHistory('[]', {
        stage: input.initialStage,
        enteredAt: now,
        by: ctx.session!.user.id,
      });

      const opp = await ctx.db.opportunity.create({
        data: {
          orgId: ctx.orgId!,
          stage: input.initialStage,
          stageHistory,
          sourceId: input.sourceId,
          sourceLeadId: input.sourceLeadId,
          serviceCategory: input.serviceCategory,
          description: input.description,
          customerName: input.customerName,
          customerPhone: input.customerPhone,
          customerEmail: input.customerEmail,
          addressLine: input.addressLine,
          city: input.city,
          state: input.state,
          zip: input.zip,
          priority: input.priority,
          enteredCurrentStageAt: now,
        },
      });

      await writeAudit(ctx, {
        action: 'opportunity.created',
        entityType: 'opportunity',
        entityId: opp.id,
        after: { stage: opp.stage, sourceId: opp.sourceId, customerName: opp.customerName },
      });

      return opp;
    }),

  /**
   * Stage transition with validation + history append + audit.
   */
  transitionStage: requireRoles(['admin', 'dispatcher', 'tech'])
    .input(
      z.object({
        id: z.string(),
        toStage: stageSchema,
        lostReason: lostReasonSchema.optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const opp = await ctx.db.opportunity.findFirst({
        where: { id: input.id, orgId: ctx.orgId! },
      });
      if (!opp) throw new TRPCError({ code: 'NOT_FOUND' });

      const fromStage = opp.stage as any;
      if (fromStage === input.toStage) {
        return opp; // no-op
      }
      if (!canTransition(fromStage, input.toStage)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Cannot transition from '${fromStage}' to '${input.toStage}'`,
        });
      }
      if (input.toStage === 'lost' && !input.lostReason) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `lostReason is required when moving to 'lost'`,
        });
      }

      // Tech can only transition own jobs through the field-execution path
      if (ctx.session!.user.role === 'tech') {
        const tech = await ctx.db.technician.findUnique({
          where: { userId: ctx.session!.user.id },
        });
        if (!tech || opp.technicianId !== tech.id) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Tech can only transition own assigned opportunities',
          });
        }
        const techAllowed: any[] = ['on_the_way', 'in_progress', 'done'];
        if (!techAllowed.includes(input.toStage)) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: `Tech cannot set stage '${input.toStage}'`,
          });
        }
      }

      const now = new Date();
      const newHistory = appendStageHistory(opp.stageHistory, {
        stage: input.toStage,
        enteredAt: now,
        by: ctx.session!.user.id,
        lostReason: input.lostReason,
      });

      const tsField = STAGE_TIMESTAMP_FIELD[input.toStage];
      const updateData: Record<string, any> = {
        stage: input.toStage,
        stageHistory: newHistory,
        enteredCurrentStageAt: now,
        ...(input.lostReason && { lostReason: input.lostReason }),
        ...(tsField && { [tsField]: now }),
        // Keep tech-side timestamps in sync if they map naturally
        ...(input.toStage === 'in_progress' && !opp.actualStart && { actualStart: now }),
        ...(input.toStage === 'done' && !opp.actualEnd && { actualEnd: now }),
      };

      const updated = await ctx.db.opportunity.update({
        where: { id: input.id },
        data: updateData,
      });

      await writeAudit(ctx, {
        action: 'opportunity.stage_changed',
        entityType: 'opportunity',
        entityId: input.id,
        before: { stage: fromStage },
        after: { stage: input.toStage, lostReason: input.lostReason },
      });

      return updated;
    }),

  /**
   * Quick funnel summary — used by Lead Funnel widget (T-DASH-12) and dashboard.
   */
  summary: protectedProcedure
    .input(
      z.object({
        from: z.date().optional(),
        to: z.date().optional(),
      }).default({}),
    )
    .query(async ({ ctx, input }) => {
      const where: any = { orgId: ctx.orgId! };
      if (input.from || input.to) {
        where.createdAt = {
          ...(input.from && { gte: input.from }),
          ...(input.to && { lte: input.to }),
        };
      }

      const grouped = await ctx.db.opportunity.groupBy({
        by: ['stage'],
        where,
        _count: { _all: true },
      });
      const byStage: Record<string, number> = {};
      for (const g of grouped) byStage[g.stage] = (g._count as any)._all;

      const total = grouped.reduce((s, g) => s + ((g._count as any)._all ?? 0), 0);
      const leadStageCount = LEAD_STAGES.reduce((s, st) => s + (byStage[st] ?? 0), 0);
      const jobStageCount = JOB_STAGES.reduce((s, st) => s + (byStage[st] ?? 0), 0);
      const lostCount = byStage['lost'] ?? 0;

      // Conversion: leads (any active lead stage or further) → won (paid)
      const wonCount = byStage['paid'] ?? 0;
      const conversionRate = total > 0 ? wonCount / total : 0;

      return {
        total,
        byStage,
        leadStageCount,
        jobStageCount,
        lostCount,
        wonCount,
        conversionRate,
      };
    }),

  /**
   * Aging — opportunities stuck in stage longer than threshold (used by T-CORE-AGING cron).
   */
  aging: protectedProcedure
    .input(
      z.object({
        stage: stageSchema.optional(),
        olderThanDays: z.number().min(1).max(90).default(7),
      }),
    )
    .query(async ({ ctx, input }) => {
      const cutoff = new Date(Date.now() - input.olderThanDays * 86400000);
      return ctx.db.opportunity.findMany({
        where: {
          orgId: ctx.orgId!,
          ...(input.stage ? { stage: input.stage } : { stage: { notIn: ['paid', 'lost'] } }),
          enteredCurrentStageAt: { lt: cutoff },
        },
        include: {
          customer: { select: { id: true, billingName: true, phone: true } },
          technician: { include: { user: { select: { fullName: true } } } },
        },
        orderBy: { enteredCurrentStageAt: 'asc' },
      });
    }),
});
