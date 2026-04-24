import { z } from 'zod';
import { protectedProcedure, router } from '../trpc';
import { TRPCError } from '@trpc/server';

// Sequential job number: J-2026-XXXX
async function generateJobNumber(db: any, orgId: string): Promise<string> {
  const year = new Date().getFullYear();
  const lastJob = await db.job.findFirst({
    where: { orgId, jobNumber: { startsWith: `J-${year}-` } },
    orderBy: { jobNumber: 'desc' },
  });

  let seq = 1;
  if (lastJob) {
    const parts = lastJob.jobNumber.split('-');
    seq = parseInt(parts[2] || '0', 10) + 1;
  }

  return `J-${year}-${String(seq).padStart(4, '0')}`;
}

const createJobSchema = z.object({
  customerId: z.string(),
  propertyId: z.string(),
  leadId: z.string().optional(),
  jobType: z.enum(['repair', 'install', 'maintenance', 'inspection']),
  category: z.string(),
  description: z.string().min(5),
  priority: z.enum(['low', 'normal', 'high', 'emergency']).default('normal'),
  scheduledStart: z.date().optional(),
  scheduledEnd: z.date().optional(),
  estimatedRevenue: z.number().positive().optional(),
  requiresEstimate: z.boolean().default(false),
  internalNotes: z.string().optional(),
});

export const jobRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        status: z
          .enum([
            'new', 'scheduled', 'dispatched', 'en_route', 'on_site',
            'in_progress', 'completed', 'invoiced', 'paid', 'closed', 'canceled',
          ])
          .optional(),
        technicianId: z.string().optional(),
        from: z.date().optional(),
        to: z.date().optional(),
        limit: z.number().min(1).max(100).default(50),
        cursor: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { status, technicianId, from, to, limit, cursor } = input;

      const jobs = await ctx.db.job.findMany({
        where: {
          orgId: ctx.orgId!,
          ...(status && { status }),
          ...(technicianId && { assignedTechnicianId: technicianId }),
          ...(from || to
            ? {
                scheduledStart: {
                  ...(from && { gte: from }),
                  ...(to && { lte: to }),
                },
              }
            : {}),
        },
        include: {
          customer: { select: { id: true, billingName: true, phone: true } },
          property: { select: { id: true, addressLine1: true, city: true, state: true } },
          technician: { include: { user: { select: { fullName: true, avatarUrl: true } } } },
          _count: { select: { items: true, attachments: true } },
        },
        take: limit + 1,
        ...(cursor && { cursor: { id: cursor }, skip: 1 }),
        orderBy: [{ scheduledStart: 'asc' }, { createdAt: 'desc' }],
      });

      const hasMore = jobs.length > limit;
      return {
        items: hasMore ? jobs.slice(0, -1) : jobs,
        nextCursor: hasMore ? jobs[jobs.length - 2]?.id : undefined,
      };
    }),

  byId: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const job = await ctx.db.job.findFirst({
        where: { id: input.id, orgId: ctx.orgId! },
        include: {
          customer: true,
          property: true,
          technician: { include: { user: true } },
          items: { orderBy: { sortOrder: 'asc' } },
          invoices: true,
          estimates: true,
          attachments: { orderBy: { uploadedAt: 'desc' } },
          calls: { orderBy: { startedAt: 'desc' }, take: 5 },
        },
      });

      if (!job) throw new TRPCError({ code: 'NOT_FOUND' });
      return job;
    }),

  create: protectedProcedure
    .input(createJobSchema)
    .mutation(async ({ ctx, input }) => {
      const jobNumber = await generateJobNumber(ctx.db, ctx.orgId!);

      const job = await ctx.db.job.create({
        data: {
          ...input,
          orgId: ctx.orgId!,
          jobNumber,
          dispatcherId: ctx.session!.user.id,
        },
        include: { customer: true, property: true },
      });

      // Update lead status if linked
      if (input.leadId) {
        await ctx.db.lead.updateMany({
          where: { id: input.leadId, orgId: ctx.orgId! },
          data: { status: 'converted', convertedAt: new Date() },
        });
      }

      await ctx.db.auditLog.create({
        data: {
          orgId: ctx.orgId!,
          userId: ctx.session!.user.id,
          action: 'job.created',
          entityType: 'job',
          entityId: job.id,
          after: JSON.stringify({ jobNumber: job.jobNumber, status: job.status }),
        },
      });

      return job;
    }),

  updateStatus: protectedProcedure
    .input(
      z.object({
        jobId: z.string(),
        status: z.enum([
          'new', 'scheduled', 'dispatched', 'en_route', 'on_site',
          'in_progress', 'completed', 'invoiced', 'paid', 'closed', 'canceled',
        ]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.job.findFirst({
        where: { id: input.jobId, orgId: ctx.orgId! },
      });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND' });

      const updates: Record<string, any> = { status: input.status };
      if (input.status === 'in_progress' && !existing.actualStart) {
        updates.actualStart = new Date();
      }
      if (input.status === 'completed' && !existing.actualEnd) {
        updates.actualEnd = new Date();
      }

      const job = await ctx.db.job.update({
        where: { id: input.jobId },
        data: updates,
      });

      await ctx.db.auditLog.create({
        data: {
          orgId: ctx.orgId!,
          userId: ctx.session!.user.id,
          action: 'job.status_changed',
          entityType: 'job',
          entityId: job.id,
          before: JSON.stringify({ status: existing.status }),
          after: JSON.stringify({ status: job.status }),
        },
      });

      return job;
    }),

  assign: protectedProcedure
    .input(
      z.object({
        jobId: z.string(),
        technicianId: z.string(),
        scheduledStart: z.date(),
        scheduledEnd: z.date(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.$transaction(async (tx) => {
        // Postgres RLS only
        if (process.env.DATABASE_PROVIDER !== 'sqlite') {
          await tx.$executeRaw`SELECT set_config('app.current_org_id', ${ctx.orgId!}, true)`;
        }

        const tech = await tx.technician.findFirstOrThrow({
          where: { id: input.technicianId, orgId: ctx.orgId!, isActive: true },
        });

        const conflict = await tx.job.findFirst({
          where: {
            assignedTechnicianId: tech.id,
            status: { in: ['dispatched', 'en_route', 'on_site', 'in_progress'] },
            OR: [
              {
                scheduledStart: { lte: input.scheduledEnd },
                scheduledEnd: { gte: input.scheduledStart },
              },
            ],
          },
        });

        if (conflict) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: `Technician has a conflicting job: ${conflict.jobNumber}`,
          });
        }

        const job = await tx.job.update({
          where: { id: input.jobId },
          data: {
            assignedTechnicianId: tech.id,
            scheduledStart: input.scheduledStart,
            scheduledEnd: input.scheduledEnd,
            status: 'dispatched',
          },
          include: { technician: { include: { user: true } }, customer: true },
        });

        await tx.auditLog.create({
          data: {
            orgId: ctx.orgId!,
            userId: ctx.session!.user.id,
            action: 'job.assigned',
            entityType: 'job',
            entityId: job.id,
            after: JSON.stringify({ technicianId: tech.id, scheduledStart: input.scheduledStart }),
          },
        });

        return job;
      });
    }),

  addItems: protectedProcedure
    .input(
      z.object({
        jobId: z.string(),
        items: z.array(
          z.object({
            itemType: z.enum(['labor', 'part', 'service', 'discount']),
            name: z.string(),
            qty: z.number().positive(),
            unitPrice: z.number(),
            sortOrder: z.number().default(0),
          }),
        ),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const job = await ctx.db.job.findFirst({
        where: { id: input.jobId, orgId: ctx.orgId! },
      });
      if (!job) throw new TRPCError({ code: 'NOT_FOUND' });

      // Delete existing items and replace
      await ctx.db.jobItem.deleteMany({ where: { jobId: input.jobId } });

      const created = await ctx.db.jobItem.createMany({
        data: input.items.map((item) => ({
          jobId: input.jobId,
          orgId: ctx.orgId!,
          ...item,
          total: item.qty * item.unitPrice,
        })),
      });

      // Update estimated revenue
      const total = input.items.reduce((sum, item) => sum + item.qty * item.unitPrice, 0);
      await ctx.db.job.update({
        where: { id: input.jobId },
        data: { estimatedRevenue: total },
      });

      return { count: created.count, total };
    }),
});
