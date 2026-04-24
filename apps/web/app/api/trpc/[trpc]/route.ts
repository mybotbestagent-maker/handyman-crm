import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { appRouter, createContext } from '@handyman-crm/api';
import type { NextRequest } from 'next/server';
import type { Session } from '@handyman-crm/api';

/**
 * tRPC handler — handles all /api/trpc/* requests
 *
 * LOCAL DEV: when DEV_MOCK_AUTH=true, injects a hardcoded admin session
 * so pages work without Supabase configured.
 *
 * PRODUCTION: replace with real Supabase session extraction.
 */
function getDevSession(): Session {
  return {
    user: {
      id: process.env.DEV_USER_ID ?? 'user-farrukh-admin',
      email: 'farrukh@handymangoldhands.com',
      orgId: process.env.DEV_ORG_ID ?? 'org-handyman-gold-hands',
      role: 'admin',
      fullName: 'Farrukh Rakhimov',
    },
  };
}

const handler = (req: NextRequest) =>
  fetchRequestHandler({
    endpoint: '/api/trpc',
    req,
    router: appRouter,
    createContext: () => {
      const session =
        process.env.DEV_MOCK_AUTH === 'true' ? getDevSession() : null;
      return createContext({ session, req });
    },
    onError:
      process.env.NODE_ENV === 'development'
        ? ({ path, error }) => {
            console.error(`tRPC error on ${path ?? '<no-path>'}:`, error);
          }
        : undefined,
  });

export { handler as GET, handler as POST };
