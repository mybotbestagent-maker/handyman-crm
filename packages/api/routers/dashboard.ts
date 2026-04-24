import { z } from 'zod';
import { protectedProcedure, router } from '../trpc';

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
        totalJobs,
        newLeads,
        openInvoicesResult,
        recentJobs,
        jobsByStatus,
      ] = await Promise.all([
        ctx.db.job.count({
          where: {
            orgId: ctx.orgId!,
            createdAt: { gte: from, lte: to },
          },
        }),
        ctx.db.lead.count({
          where: {
            orgId: ctx.orgId!,
            receivedAt: { gte: from, lte: to },
            status: 'new',
          },
        }),
        ctx.db.invoice.aggregate({
          where: {
            orgId: ctx.orgId!,
            status: { in: ['sent', 'partial', 'overdue'] },
          },
          _sum: { total: true, amountPaid: true },
          _count: true,
        }),
        ctx.db.job.findMany({
          where: { orgId: ctx.orgId!, status: { notIn: ['closed', 'canceled'] } },
          include: {
            customer: { select: { billingName: true } },
            technician: { include: { user: { select: { fullName: true } } } },
          },
          orderBy: { updatedAt: 'desc' },
          take: 5,
        }),
        ctx.db.job.groupBy({
          by: ['status'],
          where: { orgId: ctx.orgId! },
          _count: { id: true },
        }),
      ]);

      const totalOwed = Number(openInvoicesResult._sum.total ?? 0);
      const totalPaid = Number(openInvoicesResult._sum.amountPaid ?? 0);

      return {
        totalJobs,
        newLeads,
        openInvoices: {
          count: openInvoicesResult._count,
          outstanding: totalOwed - totalPaid,
        },
        recentJobs,
        jobsByStatus: Object.fromEntries(
          jobsByStatus.map((g) => [g.status, g._count.id]),
        ),
      };
    }),
});
