/**
 * tRPC initialization — procedures and middleware
 */
import { initTRPC, TRPCError } from '@trpc/server';
import superjson from 'superjson';
import { ZodError } from 'zod';
import type { Context, Session } from './context';

const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError: error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

export const router = t.router;
export const publicProcedure = t.procedure;
export const createCallerFactory = t.createCallerFactory;

const isPostgres = process.env.DATABASE_PROVIDER !== 'sqlite';

/**
 * Middleware: enforce org context + optionally set Postgres RLS session var.
 * When DATABASE_PROVIDER=sqlite the $executeRaw is skipped (SQLite doesn't
 * support set_config). Tenant isolation is handled by orgId in every WHERE.
 */
const enforceOrgContext = t.middleware(async ({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
  }
  if (!ctx.orgId) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'No org context' });
  }

  if (isPostgres) {
    // Set PostgreSQL session variable for RLS
    await ctx.db.$executeRaw`SELECT set_config('app.current_org_id', ${ctx.orgId}, true)`;
  }

  return next({
    ctx: {
      ...ctx,
      session: ctx.session,
      orgId: ctx.orgId,
    },
  });
});

export const protectedProcedure = t.procedure.use(enforceOrgContext);

/**
 * Admin-only middleware
 */
const enforceAdmin = t.middleware(async ({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }
  if (ctx.session.user.role !== 'admin') {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin only' });
  }
  if (isPostgres) {
    await ctx.db.$executeRaw`SELECT set_config('app.current_org_id', ${ctx.orgId}, true)`;
  }
  return next({ ctx });
});

export const adminProcedure = t.procedure.use(enforceAdmin);

/**
 * Role-based procedure factory.
 *
 * Usage:
 *   export const myRouter = router({
 *     deleteCustomer: requireRoles(['admin']).mutation(...),
 *     createJob:      requireRoles(['admin', 'dispatcher']).mutation(...),
 *     myJobs:         requireRoles(['admin', 'dispatcher', 'tech']).query(...),
 *   });
 *
 * Always layered after auth + org context (same checks as protectedProcedure).
 * Throws FORBIDDEN if user role is not in allowed list.
 *
 * For tech-scoped queries (only-own-data), the procedure should additionally
 * filter by ctx.session.user.id — middleware can't know "own" vs "all" semantics.
 */
export function requireRoles(allowed: Array<'admin' | 'dispatcher' | 'tech' | 'customer' | 'owner'>) {
  return t.procedure.use(async ({ ctx, next }) => {
    if (!ctx.session?.user) {
      throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
    }
    if (!ctx.orgId) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'No org context' });
    }
    const role = ctx.session.user.role;
    if (!allowed.includes(role as any)) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: `Role '${role}' not permitted. Required: ${allowed.join(' | ')}`,
      });
    }
    if (isPostgres) {
      await ctx.db.$executeRaw`SELECT set_config('app.current_org_id', ${ctx.orgId}, true)`;
    }
    return next({ ctx });
  });
}

/**
 * Helper to write an audit log entry from inside a mutation.
 * Centralized here so every mutation uses the same shape and we can later
 * swap the storage layer (e.g. ship to Sentry, ClickHouse) without touching routers.
 */
export async function writeAudit(
  ctx: { db: any; session: Session | null; orgId: string | null },
  args: {
    action: string;
    entityType: string;
    entityId: string;
    before?: unknown;
    after?: unknown;
  },
) {
  if (!ctx.session || !ctx.orgId) return; // never throw in audit path
  try {
    await ctx.db.auditLog.create({
      data: {
        orgId: ctx.orgId,
        userId: ctx.session.user.id,
        action: args.action,
        entityType: args.entityType,
        entityId: args.entityId,
        before: args.before ? JSON.stringify(args.before) : null,
        after: args.after ? JSON.stringify(args.after) : null,
      },
    });
  } catch (e) {
    console.error('[audit] failed to write log', { action: args.action, error: e });
  }
}

