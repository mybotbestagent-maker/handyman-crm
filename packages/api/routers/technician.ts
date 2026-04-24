import { z } from 'zod';
import { protectedProcedure, router } from '../trpc';
import { TRPCError } from '@trpc/server';

export const technicianRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        isActive: z.boolean().optional(),
        skill: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      return ctx.db.technician.findMany({
        where: {
          orgId: ctx.orgId!,
          ...(input.isActive !== undefined && { isActive: input.isActive }),
        },
        include: {
          user: { select: { fullName: true, email: true, phone: true, avatarUrl: true } },
        },
        orderBy: { rating: 'desc' },
      });
    }),

  availability: protectedProcedure
    .input(
      z.object({
        date: z.date(),
        duration: z.number().default(120), // minutes
      }),
    )
    .query(async ({ ctx, input }) => {
      const dayStart = new Date(input.date);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(input.date);
      dayEnd.setHours(23, 59, 59, 999);

      const technicians = await ctx.db.technician.findMany({
        where: { orgId: ctx.orgId!, isActive: true },
        include: {
          user: { select: { fullName: true, avatarUrl: true } },
          jobs: {
            where: {
              scheduledStart: { gte: dayStart, lte: dayEnd },
              status: { notIn: ['canceled', 'closed'] },
            },
            select: { scheduledStart: true, scheduledEnd: true, status: true, jobNumber: true },
          },
        },
      });

      return technicians;
    }),
});
