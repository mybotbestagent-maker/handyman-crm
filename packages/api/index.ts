import { router } from './trpc';
import { authRouter } from './routers/auth';
import { customerRouter } from './routers/customer';
import { jobRouter } from './routers/job';
import { leadRouter } from './routers/lead';
import { technicianRouter } from './routers/technician';
import { dashboardRouter } from './routers/dashboard';
// T-CORE-OPPORTUNITY Step 4 router exists at routers/opportunity.ts but is
// INTENTIONALLY NOT EXPOSED until Farrukh reviews the design (per his
// stop-line at Step 3 — see migration-log.md).
// import { opportunityRouter } from './routers/opportunity';

export const appRouter = router({
  auth: authRouter,
  customer: customerRouter,
  job: jobRouter,
  lead: leadRouter,
  technician: technicianRouter,
  dashboard: dashboardRouter,
});

export type AppRouter = typeof appRouter;

export { createContext } from './context';
export type { Context, Session } from './context';
export { createCallerFactory } from './trpc';
