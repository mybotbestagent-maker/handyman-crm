import { router } from './trpc';
import { authRouter } from './routers/auth';
import { customerRouter } from './routers/customer';
import { jobRouter } from './routers/job';
import { leadRouter } from './routers/lead';
import { technicianRouter } from './routers/technician';
import { dashboardRouter } from './routers/dashboard';
// T-CORE-OPPORTUNITY Step 4: wire-up approved 2026-04-30 (M1 sprint).
// Shadow-mode: old job/lead routers stay operational. UI cuts over per-screen.
import { opportunityRouter } from './routers/opportunity';

export const appRouter = router({
  auth: authRouter,
  customer: customerRouter,
  job: jobRouter,
  lead: leadRouter,
  technician: technicianRouter,
  dashboard: dashboardRouter,
  opportunity: opportunityRouter,
});

export type AppRouter = typeof appRouter;

export { createContext } from './context';
export type { Context, Session } from './context';
export { createCallerFactory } from './trpc';
