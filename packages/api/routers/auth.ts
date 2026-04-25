import { z } from 'zod';
import { protectedProcedure, router, requireRoles, writeAudit } from '../trpc';
import { TRPCError } from '@trpc/server';

// All roles known to the system. Order matters for UI sorting.
export const ALL_ROLES = ['admin', 'dispatcher', 'tech', 'customer'] as const;
export type Role = (typeof ALL_ROLES)[number];

/**
 * Permission map — single source of truth for what each role can do.
 * Consumed by `auth.permissions` (UI hides nav items + buttons based on this).
 *
 * For T18 RBAC (PERMISSIONS_MATRIX.md), this expands to entity × action × scope.
 * v0 keeps it as flat capability flags — simple, debuggable.
 */
export const ROLE_PERMISSIONS: Record<Role, string[]> = {
  admin: [
    'view:dashboard', 'view:reports', 'view:settings', 'view:audit',
    'view:customers', 'create:customer', 'update:customer', 'delete:customer',
    'view:jobs', 'create:job', 'update:job', 'delete:job', 'assign:job', 'change:job_status',
    'view:invoices', 'create:invoice', 'void:invoice',
    'view:leads', 'create:lead', 'update:lead',
    'view:technicians', 'create:technician', 'update:technician',
    'view:financial_fields', 'view:cost_fields', 'view:internal_notes',
    'manage:roles', 'manage:integrations',
  ],
  dispatcher: [
    'view:dashboard', 'view:reports',
    'view:customers', 'create:customer', 'update:customer',
    'view:jobs', 'create:job', 'update:job', 'assign:job', 'change:job_status',
    'view:invoices',
    'view:leads', 'create:lead', 'update:lead',
    'view:technicians',
    'view:internal_notes',
  ],
  tech: [
    'view:jobs:assigned', 'change:job_status:assigned',
    'view:customers:assigned', 'view:internal_notes',
  ],
  customer: [
    'view:jobs:own', 'view:invoices:own',
  ],
};

export const authRouter = router({
  /**
   * Returns current user info + role + capability list.
   * UI uses this to decide what to render. Also useful for debugging "why can't I see X".
   */
  me: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session!.user.id;
    const user = await ctx.db.user.findUnique({
      where: { id: userId },
      include: { org: { select: { id: true, name: true, slug: true } } },
    });

    if (!user) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'User not in DB' });
    }

    const role = (user.role as Role) ?? 'customer';
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      avatarUrl: user.avatarUrl,
      role,
      isActive: user.isActive,
      org: user.org,
      permissions: ROLE_PERMISSIONS[role] ?? [],
    };
  }),

  /**
   * Set role for a user — admin only.
   * Logs the change to AuditLog.
   */
  setUserRole: requireRoles(['admin'])
    .input(
      z.object({
        userId: z.string(),
        role: z.enum(ALL_ROLES),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const target = await ctx.db.user.findFirst({
        where: { id: input.userId, orgId: ctx.orgId! },
      });
      if (!target) throw new TRPCError({ code: 'NOT_FOUND' });

      // Prevent removing last admin
      if (target.role === 'admin' && input.role !== 'admin') {
        const adminCount = await ctx.db.user.count({
          where: { orgId: ctx.orgId!, role: 'admin', isActive: true },
        });
        if (adminCount <= 1) {
          throw new TRPCError({
            code: 'PRECONDITION_FAILED',
            message: 'Cannot demote the last admin',
          });
        }
      }

      const updated = await ctx.db.user.update({
        where: { id: input.userId },
        data: { role: input.role },
      });

      await writeAudit(ctx, {
        action: 'user.role_changed',
        entityType: 'user',
        entityId: input.userId,
        before: { role: target.role },
        after: { role: input.role },
      });

      return updated;
    }),

  /**
   * List recent audit log entries — admin only.
   * For Settings → Activity Log UI.
   */
  auditLog: requireRoles(['admin'])
    .input(
      z.object({
        entityType: z.string().optional(),
        entityId: z.string().optional(),
        userId: z.string().optional(),
        limit: z.number().min(1).max(200).default(50),
      }),
    )
    .query(async ({ ctx, input }) => {
      const entries = await ctx.db.auditLog.findMany({
        where: {
          orgId: ctx.orgId!,
          ...(input.entityType && { entityType: input.entityType }),
          ...(input.entityId && { entityId: input.entityId }),
          ...(input.userId && { userId: input.userId }),
        },
        orderBy: { createdAt: 'desc' },
        take: input.limit,
      });

      // Hydrate userId → user info (no FK relation in schema, so do a manual join)
      const userIds = Array.from(new Set(entries.map((e) => e.userId).filter(Boolean) as string[]));
      const users = userIds.length
        ? await ctx.db.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, fullName: true, email: true, role: true },
          })
        : [];
      const userMap = new Map(users.map((u) => [u.id, u]));

      return entries.map((e) => ({
        ...e,
        user: e.userId ? userMap.get(e.userId) ?? null : null,
      }));
    }),
});
