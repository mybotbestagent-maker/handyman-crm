import { router } from './trpc';
import { authRouter } from './routers/auth';
import { customerRouter } from './routers/customer';
import { jobRouter } from './routers/job';
import { leadRouter } from './routers/lead';
import { technicianRouter } from './routers/technician';
import { dashboardRouter } from './routers/dashboard';
import { opportunityRouter } from './routers/opportunity';

export const appRouter = router({
  auth: authRouter,
  customer: customerRouter,
  job: jobRouter,
  lead: leadRouter,
  technician: technicianRouter,
  dashboard: dashboardRouter,
  // T-CORE-OPPORTUNITY: shadow router. UI not migrated yet — old job/lead routers remain in use.
  opportunity: opportunityRouter,
});

export type AppRouter = typeof appRouter;

export { createContext } from './context';
export type { Context, Session } from './context';
export { createCallerFactory } from './trpc';
