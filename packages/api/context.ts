/**
 * tRPC context — created once per request
 * Provides db + session + orgId to all procedures
 */
import { db } from '@handyman-crm/db';

// Role is a string in SQLite schema; enum in Postgres schema.
// Use string type here for compatibility across both.
export type UserRole = 'admin' | 'dispatcher' | 'tech' | 'customer';

export type Session = {
  user: {
    id: string;
    email: string;
    orgId: string;
    role: UserRole | string;
    fullName: string;
  };
};

export type Context = {
  db: typeof db;
  session: Session | null;
  orgId: string | null;
  req?: Request;
};

type CreateContextOptions = {
  session: Session | null;
  req?: Request;
};

export function createContext({ session, req }: CreateContextOptions): Context {
  const orgId = session?.user?.orgId ?? null;
  return {
    db,
    session,
    orgId,
    req,
  };
}
