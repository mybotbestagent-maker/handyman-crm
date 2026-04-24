import { z } from 'zod';
import { protectedProcedure, router } from '../trpc';
import { TRPCError } from '@trpc/server';

export const leadRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        status: z.enum(['new', 'contacted', 'qualified', 'converted', 'dead']).optional(),
        source: z.string().optional(),
        limit: z.number().min(1).max(100).default(50),
        cursor: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const leads = await ctx.db.lead.findMany({
        where: {
          orgId: ctx.orgId!,
          ...(input.status && { status: input.status }),
          ...(input.source && { source: input.source }),
        },
        include: {
          customer: { select: { id: true, billingName: true, phone: true } },
        },
        take: input.limit + 1,
        ...(input.cursor && { cursor: { id: input.cursor }, skip: 1 }),
        orderBy: { receivedAt: 'desc' },
      });

      const hasMore = leads.length > input.limit;
      return {
        items: hasMore ? leads.slice(0, -1) : leads,
        nextCursor: hasMore ? leads[leads.length - 2]?.id : undefined,
      };
    }),

  create: protectedProcedure
    .input(
      z.object({
        source: z.string(),
        sourceMeta: z.record(z.unknown()).default({}),
        serviceType: z.string(),
        description: z.string().min(5),
        zip: z.string(),
        customerName: z.string().optional(),
        customerPhone: z.string().optional(),
        customerEmail: z.string().email().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { customerName, customerPhone, customerEmail, sourceMeta, ...leadData } = input;

      // Try to find existing customer by phone
      let customerId: string | undefined;
      if (customerPhone) {
        const normalized = customerPhone.replace(/\D/g, '');
        const existing = await ctx.db.customer.findFirst({
          where: { orgId: ctx.orgId!, phone: { contains: normalized } },
        });
        customerId = existing?.id;

        // Create new customer if not found
        if (!customerId && customerName) {
          const newCustomer = await ctx.db.customer.create({
            data: {
              orgId: ctx.orgId!,
              billingName: customerName,
              phone: normalized.startsWith('1') ? `+${normalized}` : `+1${normalized}`,
              email: customerEmail,
              billingAddress: JSON.stringify({ line1: '', city: '', state: '', zip: leadData.zip, country: 'US' }),
              tags: JSON.stringify([]),
              source: input.source,
            },
          });
          customerId = newCustomer.id;
        }
      }

      const lead = await ctx.db.lead.create({
        data: {
          ...leadData,
          orgId: ctx.orgId!,
          customerId,
          sourceMeta: JSON.stringify(sourceMeta),
        },
      });

      return lead;
    }),

  updateStatus: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        status: z.enum(['new', 'contacted', 'qualified', 'converted', 'dead']),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const lead = await ctx.db.lead.findFirst({
        where: { id: input.id, orgId: ctx.orgId! },
      });
      if (!lead) throw new TRPCError({ code: 'NOT_FOUND' });

      return ctx.db.lead.update({
        where: { id: input.id },
        data: {
          status: input.status,
          ...(input.status === 'converted' && { convertedAt: new Date() }),
        },
      });
    }),
});
