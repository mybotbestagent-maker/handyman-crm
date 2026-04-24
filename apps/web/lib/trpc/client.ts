import { createTRPCReact } from '@trpc/react-query';
import type { AppRouter } from '@handyman-crm/api';

export const api = createTRPCReact<AppRouter>();
