import { z } from 'zod';
import { protectedProcedure, router, requireRoles, writeAudit } from '../trpc';
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

  create: requireRoles(['admin', 'dispatcher'])
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

      await writeAudit(ctx, {
        action: 'lead.created',
        entityType: 'lead',
        entityId: lead.id,
        after: { source: lead.source, serviceType: lead.serviceType, customerId },
      });

      return lead;
    }),

  byId: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const lead = await ctx.db.lead.findFirst({
        where: { id: input.id, orgId: ctx.orgId! },
        include: {
          customer: { select: { id: true, billingName: true, phone: true, email: true } },
        },
      });
      if (!lead) throw new TRPCError({ code: 'NOT_FOUND' });
      return lead;
    }),

  updateStatus: requireRoles(['admin', 'dispatcher'])
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

      const updated = await ctx.db.lead.update({
        where: { id: input.id },
        data: {
          status: input.status,
          ...(input.status === 'converted' && { convertedAt: new Date() }),
        },
      });

      await writeAudit(ctx, {
        action: 'lead.status_changed',
        entityType: 'lead',
        entityId: input.id,
        before: { status: lead.status },
        after: { status: input.status },
      });

      return updated;
    }),

  /**
   * Full Lead → Customer conversion flow.
   *
   * Steps:
   * 1. Find or create Customer (phone-based dedupe)
   * 2. If new address provided, create Property
   * 3. Mark lead as converted + link customerId
   * 4. Return { customerId, isNewCustomer, propertyId }
   *
   * Job creation is intentionally left to the caller (jobs page)
   * so the user can review/edit job details before saving.
   */
  convert: requireRoles(['admin', 'dispatcher'])
    .input(
      z.object({
        leadId: z.string(),
        // Customer data (used when creating new or overriding)
        customerName: z.string().min(2),
        customerPhone: z.string().min(10),
        customerEmail: z.string().email().optional(),
        customerType: z.enum(['residential', 'commercial']).default('residential'),
        // Address for the service property
        serviceAddress: z.object({
          line1: z.string().min(3),
          city: z.string().min(1),
          state: z.string().length(2),
          zip: z.string().min(5),
        }).optional(),
        // If the caller already matched an existing customer, pass their id to skip creation
        existingCustomerId: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const lead = await ctx.db.lead.findFirst({
        where: { id: input.leadId, orgId: ctx.orgId! },
      });
      if (!lead) throw new TRPCError({ code: 'NOT_FOUND', message: 'Lead not found' });
      if (lead.status === 'converted') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Lead already converted' });
      }

      const normalizedPhone = input.customerPhone.replace(/\D/g, '');
      const e164Phone = normalizedPhone.startsWith('1') ? `+${normalizedPhone}` : `+1${normalizedPhone}`;

      // ── 1. Find or create customer ────────────────────────────────────────
      let customerId: string;
      let isNewCustomer = false;

      if (input.existingCustomerId) {
        const existing = await ctx.db.customer.findFirst({
          where: { id: input.existingCustomerId, orgId: ctx.orgId! },
        });
        if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Linked customer not found' });
        customerId = existing.id;
      } else {
        // Phone dedupe — last 10 digits
        const last10 = normalizedPhone.slice(-10);
        const existing = await ctx.db.customer.findFirst({
          where: {
            orgId: ctx.orgId!,
            OR: [
              { phone: { contains: last10 } },
              { alternatePhone: { contains: last10 } },
            ],
          },
        });

        if (existing) {
          customerId = existing.id;
        } else {
          const newCustomer = await ctx.db.customer.create({
            data: {
              orgId: ctx.orgId!,
              billingName: input.customerName,
              phone: e164Phone,
              email: input.customerEmail,
              type: input.customerType,
              billingAddress: JSON.stringify({
                line1: input.serviceAddress?.line1 ?? '',
                city: input.serviceAddress?.city ?? '',
                state: input.serviceAddress?.state ?? '',
                zip: input.serviceAddress?.zip ?? lead.zip,
                country: 'US',
              }),
              tags: JSON.stringify([]),
              source: lead.source,
            },
          });
          customerId = newCustomer.id;
          isNewCustomer = true;
        }
      }

      // ── 2. Optionally create property ─────────────────────────────────────
      let propertyId: string | null = null;
      if (input.serviceAddress) {
        const property = await ctx.db.property.create({
          data: {
            orgId: ctx.orgId!,
            customerId,
            addressLine1: input.serviceAddress.line1,
            city: input.serviceAddress.city,
            state: input.serviceAddress.state,
            zip: input.serviceAddress.zip,
            isPrimary: isNewCustomer, // first property for new customer = primary
          },
        });
        propertyId = property.id;
      }

      // ── 3. Mark lead converted ────────────────────────────────────────────
      await ctx.db.lead.update({
        where: { id: input.leadId },
        data: {
          status: 'converted',
          convertedAt: new Date(),
          customerId,
        },
      });

      await writeAudit(ctx, {
        action: 'lead.converted',
        entityType: 'lead',
        entityId: input.leadId,
        before: { status: lead.status },
        after: { status: 'converted', customerId, isNewCustomer, propertyId },
      });

      return { customerId, isNewCustomer, propertyId };
    }),
});
