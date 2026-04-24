import { z } from 'zod';
import { protectedProcedure, router } from '../trpc';
import { TRPCError } from '@trpc/server';

const addressSchema = z.object({
  line1: z.string(),
  line2: z.string().optional(),
  city: z.string(),
  state: z.string().length(2),
  zip: z.string(),
  country: z.string().default('US'),
});

const customerCreateSchema = z.object({
  type: z.enum(['residential', 'commercial']).default('residential'),
  companyName: z.string().optional(),
  billingName: z.string().min(2),
  email: z.string().email().optional(),
  phone: z.string().min(10),
  alternatePhone: z.string().optional(),
  billingAddress: addressSchema,
  tags: z.array(z.string()).default([]),
  source: z.string().optional(),
  notes: z.string().optional(),
});

export const customerRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        search: z.string().optional(),
        type: z.enum(['residential', 'commercial']).optional(),
        limit: z.number().min(1).max(100).default(50),
        cursor: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { search, type, limit, cursor } = input;

      const customers = await ctx.db.customer.findMany({
        where: {
          orgId: ctx.orgId!,
          ...(type && { type }),
          ...(search && {
            OR: [
              { billingName: { contains: search } },
              { email: { contains: search } },
              { phone: { contains: search } },
              { companyName: { contains: search } },
            ],
          }),
        },
        include: {
          properties: { where: { isPrimary: true }, take: 1 },
          _count: { select: { jobs: true } },
        },
        take: limit + 1,
        ...(cursor && { cursor: { id: cursor }, skip: 1 }),
        orderBy: { createdAt: 'desc' },
      });

      const hasMore = customers.length > limit;
      const items = hasMore ? customers.slice(0, -1) : customers;

      return {
        items,
        nextCursor: hasMore ? items[items.length - 1]?.id : undefined,
      };
    }),

  byId: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const customer = await ctx.db.customer.findFirst({
        where: { id: input.id, orgId: ctx.orgId! },
        include: {
          properties: true,
          jobs: {
            orderBy: { createdAt: 'desc' },
            take: 10,
            include: { technician: { include: { user: true } } },
          },
          invoices: { orderBy: { createdAt: 'desc' }, take: 5 },
          calls: { orderBy: { startedAt: 'desc' }, take: 5 },
        },
      });

      if (!customer) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Customer not found' });
      }

      return customer;
    }),

  create: protectedProcedure
    .input(customerCreateSchema)
    .mutation(async ({ ctx, input }) => {
      // Normalize phone
      const normalizedPhone = input.phone.replace(/\D/g, '');

      // Check duplicate by phone
      const existing = await ctx.db.customer.findFirst({
        where: { orgId: ctx.orgId!, phone: { contains: normalizedPhone } },
      });
      if (existing) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: `Customer with this phone already exists (ID: ${existing.id})`,
        });
      }

      const { billingAddress, tags, ...rest } = input;

      const customer = await ctx.db.customer.create({
        data: {
          ...rest,
          orgId: ctx.orgId!,
          phone: normalizedPhone.startsWith('1')
            ? `+${normalizedPhone}`
            : `+1${normalizedPhone}`,
          billingAddress: JSON.stringify(billingAddress),
          tags: JSON.stringify(tags),
        },
      });

      await ctx.db.auditLog.create({
        data: {
          orgId: ctx.orgId!,
          userId: ctx.session!.user.id,
          action: 'customer.created',
          entityType: 'customer',
          entityId: customer.id,
          after: JSON.stringify({ id: customer.id, billingName: customer.billingName }),
        },
      });

      return customer;
    }),

  update: protectedProcedure
    .input(customerCreateSchema.partial().extend({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { id, billingAddress, tags, ...rest } = input;

      const existing = await ctx.db.customer.findFirst({
        where: { id, orgId: ctx.orgId! },
      });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND' });

      const customer = await ctx.db.customer.update({
        where: { id },
        data: {
          ...rest,
          ...(billingAddress && { billingAddress: JSON.stringify(billingAddress) }),
          ...(tags && { tags: JSON.stringify(tags) }),
        },
      });

      await ctx.db.auditLog.create({
        data: {
          orgId: ctx.orgId!,
          userId: ctx.session!.user.id,
          action: 'customer.updated',
          entityType: 'customer',
          entityId: id,
          before: JSON.stringify({ billingName: existing.billingName }),
          after: JSON.stringify({ billingName: customer.billingName }),
        },
      });

      return customer;
    }),
});
