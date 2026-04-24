-- =============================================================
-- Row-Level Security policies for Handyman CRM multi-tenancy
-- Run AFTER prisma migrate deploy
-- =============================================================

-- Enable RLS on all tenant-scoped tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE technicians ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE estimates ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- NOT enabled on organizations (super-admin access)

-- ---------------------------------------------------------------
-- Helper function to get current org from session variable
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION current_org_id() RETURNS uuid AS $$
  SELECT current_setting('app.current_org_id', true)::uuid;
$$ LANGUAGE sql STABLE;

-- ---------------------------------------------------------------
-- RLS Policies — tenant_isolation per table
-- USING: for SELECT, UPDATE, DELETE
-- WITH CHECK: for INSERT, UPDATE
-- ---------------------------------------------------------------

-- users
CREATE POLICY tenant_isolation ON users
  USING (org_id = current_org_id())
  WITH CHECK (org_id = current_org_id());

-- customers
CREATE POLICY tenant_isolation ON customers
  USING (org_id = current_org_id())
  WITH CHECK (org_id = current_org_id());

-- properties
CREATE POLICY tenant_isolation ON properties
  USING (org_id = current_org_id())
  WITH CHECK (org_id = current_org_id());

-- technicians
CREATE POLICY tenant_isolation ON technicians
  USING (org_id = current_org_id())
  WITH CHECK (org_id = current_org_id());

-- leads
CREATE POLICY tenant_isolation ON leads
  USING (org_id = current_org_id())
  WITH CHECK (org_id = current_org_id());

-- jobs
CREATE POLICY tenant_isolation ON jobs
  USING (org_id = current_org_id())
  WITH CHECK (org_id = current_org_id());

-- job_items
CREATE POLICY tenant_isolation ON job_items
  USING (org_id = current_org_id())
  WITH CHECK (org_id = current_org_id());

-- estimates
CREATE POLICY tenant_isolation ON estimates
  USING (org_id = current_org_id())
  WITH CHECK (org_id = current_org_id());

-- invoices
CREATE POLICY tenant_isolation ON invoices
  USING (org_id = current_org_id())
  WITH CHECK (org_id = current_org_id());

-- payments
CREATE POLICY tenant_isolation ON payments
  USING (org_id = current_org_id())
  WITH CHECK (org_id = current_org_id());

-- calls
CREATE POLICY tenant_isolation ON calls
  USING (org_id = current_org_id())
  WITH CHECK (org_id = current_org_id());

-- attachments
CREATE POLICY tenant_isolation ON attachments
  USING (org_id = current_org_id())
  WITH CHECK (org_id = current_org_id());

-- audit_log
CREATE POLICY tenant_isolation ON audit_log
  USING (org_id = current_org_id())
  WITH CHECK (org_id = current_org_id());

-- ---------------------------------------------------------------
-- Grant table access to the app role (used by Prisma connection)
-- Replace 'authenticator' with your Supabase/Prisma DB role
-- ---------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticator;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticator;
