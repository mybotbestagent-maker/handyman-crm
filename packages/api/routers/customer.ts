import { z } from 'zod';
import { protectedProcedure, router, requireRoles, writeAudit } from '../trpc';
import { TRPCError } from '@trpc/server';
import { summarizeInvoices, isInvoiceOverdue } from '../lib/business-rules';

const addressSchema = z.object({
  line1: z.string(),
  line2: z.string().optional(),
  city: z.string(),
  state: z.string().length(2),
  zip: z.string(),
  country: z.string().default('US'),
});

const propertySchema = z.object({
  addressLine1: z.string().min(3),
  addressLine2: z.string().optional(),
  city: z.string().min(1),
  state: z.string().length(2),
  zip: z.string().min(5),
  accessNotes: z.string().optional(),
  gateCode: z.string().optional(),
  petInfo: z.string().optional(),
  isPrimary: z.boolean().default(false),
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
          properties: { orderBy: { isPrimary: 'desc' } },
          jobs: {
            orderBy: { createdAt: 'desc' },
            include: {
              technician: { include: { user: true } },
              property: true,
            },
          },
          invoices: {
            orderBy: { createdAt: 'desc' },
            include: { payments: true },
          },
          calls: { orderBy: { startedAt: 'desc' }, take: 5 },
          estimates: { orderBy: { createdAt: 'desc' }, take: 10 },
        },
      });

      if (!customer) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Customer not found' });
      }

      // Auto-calculated stats — formulas live in lib/business-rules.ts
      const invoiceSummary = summarizeInvoices(customer.invoices);
      const completedJobs = customer.jobs.filter((j) =>
        ['completed', 'paid', 'invoiced'].includes(j.status),
      );
      const avgTicket = completedJobs.length > 0 ? invoiceSummary.totalSpent / completedJobs.length : 0;

      const sortedByDate = [...customer.jobs]
        .filter((j) => j.scheduledStart)
        .sort((a, b) => (a.scheduledStart!.getTime() - b.scheduledStart!.getTime()));
      const firstService = sortedByDate[0]?.scheduledStart ?? null;
      const lastService = sortedByDate[sortedByDate.length - 1]?.scheduledStart ?? null;
      const daysSinceLast = lastService
        ? Math.floor((Date.now() - lastService.getTime()) / 86400000)
        : null;

      const categoryBreakdown: Record<string, number> = {};
      customer.jobs.forEach((j) => {
        categoryBreakdown[j.category] = (categoryBreakdown[j.category] ?? 0) + 1;
      });

      return {
        ...customer,
        stats: {
          ...invoiceSummary,
          avgTicket,
          totalJobs: customer.jobs.length,
          completedJobs: completedJobs.length,
          firstService,
          lastService,
          daysSinceLast,
          categoryBreakdown,
        },
      };
    }),

  create: requireRoles(['admin', 'dispatcher'])
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

  update: requireRoles(['admin', 'dispatcher'])
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

  /**
   * Phone-based dedupe check (used before creating new customers).
   * Returns matching customer if found, null if clean.
   */
  checkDuplicate: requireRoles(['admin', 'dispatcher'])
    .input(z.object({ phone: z.string(), email: z.string().email().optional() }))
    .query(async ({ ctx, input }) => {
      const normalized = input.phone.replace(/\D/g, '');
      const last10 = normalized.slice(-10);

      const byPhone = await ctx.db.customer.findFirst({
        where: {
          orgId: ctx.orgId!,
          OR: [
            { phone: { contains: last10 } },
            { alternatePhone: { contains: last10 } },
          ],
        },
        select: { id: true, billingName: true, phone: true, email: true },
      });
      if (byPhone) return { match: byPhone, matchedOn: 'phone' as const };

      if (input.email) {
        const byEmail = await ctx.db.customer.findFirst({
          where: { orgId: ctx.orgId!, email: input.email },
          select: { id: true, billingName: true, phone: true, email: true },
        });
        if (byEmail) return { match: byEmail, matchedOn: 'email' as const };
      }

      return { match: null, matchedOn: null };
    }),

  // ── Property CRUD ─────────────────────────────────────────────────────────

  addProperty: requireRoles(['admin', 'dispatcher'])
    .input(propertySchema.extend({ customerId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Verify customer belongs to org
      const customer = await ctx.db.customer.findFirst({
        where: { id: input.customerId, orgId: ctx.orgId! },
      });
      if (!customer) throw new TRPCError({ code: 'NOT_FOUND', message: 'Customer not found' });

      const { customerId, isPrimary, ...propData } = input;

      // If marking as primary, demote existing primary
      if (isPrimary) {
        await ctx.db.property.updateMany({
          where: { customerId, orgId: ctx.orgId! },
          data: { isPrimary: false },
        });
      }

      const property = await ctx.db.property.create({
        data: {
          ...propData,
          customerId,
          orgId: ctx.orgId!,
          isPrimary,
        },
      });

      await writeAudit(ctx, {
        action: 'property.created',
        entityType: 'property',
        entityId: property.id,
        after: { customerId, addressLine1: property.addressLine1 },
      });

      return property;
    }),

  updateProperty: requireRoles(['admin', 'dispatcher'])
    .input(propertySchema.partial().extend({ id: z.string(), customerId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { id, customerId, isPrimary, ...data } = input;

      const existing = await ctx.db.property.findFirst({
        where: { id, customerId, orgId: ctx.orgId! },
      });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND' });

      if (isPrimary) {
        await ctx.db.property.updateMany({
          where: { customerId, orgId: ctx.orgId!, id: { not: id } },
          data: { isPrimary: false },
        });
      }

      return ctx.db.property.update({
        where: { id },
        data: { ...data, ...(isPrimary !== undefined && { isPrimary }) },
      });
    }),

  deleteProperty: requireRoles(['admin', 'dispatcher'])
    .input(z.object({ id: z.string(), customerId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.property.findFirst({
        where: { id: input.id, customerId: input.customerId, orgId: ctx.orgId! },
      });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND' });

      // Cannot delete if jobs linked
      const jobCount = await ctx.db.job.count({ where: { propertyId: input.id } });
      if (jobCount > 0) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: `Cannot delete: ${jobCount} job(s) linked to this property`,
        });
      }

      await ctx.db.property.delete({ where: { id: input.id } });
      return { deleted: true };
    }),
});
