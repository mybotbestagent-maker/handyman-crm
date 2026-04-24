/**
 * tRPC initialization — procedures and middleware
 */
import { initTRPC, TRPCError } from '@trpc/server';
import superjson from 'superjson';
import { ZodError } from 'zod';
import type { Context } from './context';

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
