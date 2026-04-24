import { router } from './trpc';
import { customerRouter } from './routers/customer';
import { jobRouter } from './routers/job';
import { leadRouter } from './routers/lead';
import { technicianRouter } from './routers/technician';
import { dashboardRouter } from './routers/dashboard';

export const appRouter = router({
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
