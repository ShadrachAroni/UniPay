-- UniPay Migration 0010 — Row-Level Security (RLS) & Tenant Isolation Policies
-- Implements §11, §16, §18, §19 & UniPay_RLS_Configuration_Prompt specifications

-- 1. Helper Schema & Session Identity Resolution Functions
CREATE SCHEMA IF NOT EXISTS app;

-- Get current Clerk User ID propagated through session config
CREATE OR REPLACE FUNCTION app.current_clerk_id()
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
    SELECT NULLIF(current_setting('app.clerk_user_id', true), '');
$$;

-- Get current Profile ID (either directly set in session or resolved via clerk_user_id)
CREATE OR REPLACE FUNCTION app.current_profile_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, app
AS $$
    SELECT COALESCE(
        NULLIF(current_setting('app.profile_id', true), '')::uuid,
        (SELECT id FROM public.profiles WHERE clerk_user_id = app.current_clerk_id() LIMIT 1)
    );
$$;

-- Get current Admin Role ('super_admin', 'support', 'compliance_reviewer')
CREATE OR REPLACE FUNCTION app.current_admin_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, app
AS $$
    SELECT COALESCE(
        NULLIF(current_setting('app.admin_role', true), ''),
        (SELECT role FROM public.admin_users WHERE clerk_user_id = app.current_clerk_id() LIMIT 1)
    );
$$;

-- Check if caller is an active admin
CREATE OR REPLACE FUNCTION app.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, app
AS $$
    SELECT app.current_admin_role() IS NOT NULL;
$$;

-- Check if caller is super admin
CREATE OR REPLACE FUNCTION app.is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, app
AS $$
    SELECT app.current_admin_role() = 'super_admin';
$$;

-- 2. Non-Bypass Role for Non-Superuser Execution & RLS Test Suites
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'unipay_app_user') THEN
        CREATE ROLE unipay_app_user WITH NOLOGIN NOBYPASSRLS;
    END IF;
END $$;

GRANT USAGE ON SCHEMA public TO unipay_app_user, anon, authenticated;
GRANT USAGE ON SCHEMA app TO unipay_app_user, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO unipay_app_user, anon, authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA app TO unipay_app_user, anon, authenticated;
GRANT unipay_app_user, anon, authenticated TO postgres;

-- 3. Enable RLS on All Tables (§11)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE reconciliation_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE reconciliation_exceptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE money_direction_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_rails ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE idempotency_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE outbox_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE disputes ENABLE ROW LEVEL SECURITY;

-- 4. Clean up any prior policies
DROP POLICY IF EXISTS profiles_owner_select ON profiles;
DROP POLICY IF EXISTS profiles_owner_insert ON profiles;
DROP POLICY IF EXISTS profiles_owner_update ON profiles;
DROP POLICY IF EXISTS profiles_super_admin_delete ON profiles;

DROP POLICY IF EXISTS aliases_public_select ON aliases;
DROP POLICY IF EXISTS aliases_owner_insert ON aliases;
DROP POLICY IF EXISTS aliases_owner_update ON aliases;
DROP POLICY IF EXISTS aliases_owner_delete ON aliases;

DROP POLICY IF EXISTS payment_intents_owner_select ON payment_intents;
DROP POLICY IF EXISTS payment_intents_owner_insert ON payment_intents;
DROP POLICY IF EXISTS payment_intents_owner_update ON payment_intents;

DROP POLICY IF EXISTS transactions_owner_select ON transactions;
DROP POLICY IF EXISTS transactions_admin_write ON transactions;

DROP POLICY IF EXISTS settlements_owner_select ON settlements;
DROP POLICY IF EXISTS settlements_admin_write ON settlements;

DROP POLICY IF EXISTS payouts_owner_select ON payouts;
DROP POLICY IF EXISTS payouts_owner_insert ON payouts;
DROP POLICY IF EXISTS payouts_admin_update ON payouts;

DROP POLICY IF EXISTS money_direction_owner_select ON money_direction_rules;
DROP POLICY IF EXISTS money_direction_owner_insert ON money_direction_rules;
DROP POLICY IF EXISTS money_direction_owner_update ON money_direction_rules;
DROP POLICY IF EXISTS money_direction_owner_delete ON money_direction_rules;

DROP POLICY IF EXISTS payment_rails_public_select ON payment_rails;
DROP POLICY IF EXISTS payment_rails_super_admin_write ON payment_rails;

DROP POLICY IF EXISTS admin_users_admin_select ON admin_users;
DROP POLICY IF EXISTS admin_users_super_admin_write ON admin_users;

DROP POLICY IF EXISTS audit_logs_admin_select ON audit_logs;
DROP POLICY IF EXISTS audit_logs_insert ON audit_logs;

DROP POLICY IF EXISTS ai_interactions_owner_select ON ai_interactions;
DROP POLICY IF EXISTS ai_interactions_owner_insert ON ai_interactions;

DROP POLICY IF EXISTS recon_matches_admin_select ON reconciliation_matches;
DROP POLICY IF EXISTS recon_matches_admin_write ON reconciliation_matches;
DROP POLICY IF EXISTS recon_exceptions_admin_select ON reconciliation_exceptions;
DROP POLICY IF EXISTS recon_exceptions_admin_write ON reconciliation_exceptions;

DROP POLICY IF EXISTS disputes_owner_select ON disputes;
DROP POLICY IF EXISTS disputes_owner_insert ON disputes;
DROP POLICY IF EXISTS disputes_admin_update ON disputes;

DROP POLICY IF EXISTS idempotency_admin_all ON idempotency_records;
DROP POLICY IF EXISTS webhooks_admin_all ON webhook_events;
DROP POLICY IF EXISTS outbox_admin_all ON outbox_events;

-- 5. Policies Definition

-- 5.1 Profiles: Owner can read/write own row; Admin can read/review; Super Admin can delete
CREATE POLICY profiles_owner_select ON profiles
    FOR SELECT USING (clerk_user_id = app.current_clerk_id() OR app.is_admin());

CREATE POLICY profiles_owner_insert ON profiles
    FOR INSERT WITH CHECK (clerk_user_id = app.current_clerk_id() OR app.is_admin());

CREATE POLICY profiles_owner_update ON profiles
    FOR UPDATE USING (clerk_user_id = app.current_clerk_id() OR app.is_admin())
    WITH CHECK (clerk_user_id = app.current_clerk_id() OR app.is_admin());

CREATE POLICY profiles_super_admin_delete ON profiles
    FOR DELETE USING (app.is_super_admin());

-- 5.2 Aliases: Public read for unauthenticated checkout (§19); Owner/Admin write
CREATE POLICY aliases_public_select ON aliases
    FOR SELECT USING (true);

CREATE POLICY aliases_owner_insert ON aliases
    FOR INSERT WITH CHECK (profile_id = app.current_profile_id() OR app.is_admin());

CREATE POLICY aliases_owner_update ON aliases
    FOR UPDATE USING (profile_id = app.current_profile_id() OR app.is_admin())
    WITH CHECK (profile_id = app.current_profile_id() OR app.is_admin());

CREATE POLICY aliases_owner_delete ON aliases
    FOR DELETE USING (profile_id = app.current_profile_id() OR app.is_admin());

-- 5.3 Payment Intents: Owner can view/create intents for their recipient_profile_id
CREATE POLICY payment_intents_owner_select ON payment_intents
    FOR SELECT USING (recipient_profile_id = app.current_profile_id() OR app.is_admin());

CREATE POLICY payment_intents_owner_insert ON payment_intents
    FOR INSERT WITH CHECK (recipient_profile_id = app.current_profile_id() OR app.is_admin());

CREATE POLICY payment_intents_owner_update ON payment_intents
    FOR UPDATE USING (recipient_profile_id = app.current_profile_id() OR app.is_admin())
    WITH CHECK (recipient_profile_id = app.current_profile_id() OR app.is_admin());

-- 5.4 Transactions: Owner can SELECT only. Direct mutations restricted to Admin/Trusted Backend
CREATE POLICY transactions_owner_select ON transactions
    FOR SELECT USING (recipient_profile_id = app.current_profile_id() OR app.is_admin());

CREATE POLICY transactions_admin_write ON transactions
    FOR ALL USING (app.is_admin())
    WITH CHECK (app.is_admin());

-- 5.5 Settlements: Owner can SELECT only. Direct mutations restricted to Admin/Trusted Backend
CREATE POLICY settlements_owner_select ON settlements
    FOR SELECT USING (profile_id = app.current_profile_id() OR app.is_admin());

CREATE POLICY settlements_admin_write ON settlements
    FOR ALL USING (app.is_admin())
    WITH CHECK (app.is_admin());

-- 5.6 Payouts: Owner can SELECT and request INSERT; Updates restricted to Admin
CREATE POLICY payouts_owner_select ON payouts
    FOR SELECT USING (profile_id = app.current_profile_id() OR app.is_admin());

CREATE POLICY payouts_owner_insert ON payouts
    FOR INSERT WITH CHECK (profile_id = app.current_profile_id() OR app.is_admin());

CREATE POLICY payouts_admin_update ON payouts
    FOR UPDATE USING (app.is_admin())
    WITH CHECK (app.is_admin());

-- 5.7 Money Direction Rules: Owner full CRUD
CREATE POLICY money_direction_owner_select ON money_direction_rules
    FOR SELECT USING (profile_id = app.current_profile_id() OR app.is_admin());

CREATE POLICY money_direction_owner_insert ON money_direction_rules
    FOR INSERT WITH CHECK (profile_id = app.current_profile_id() OR app.is_admin());

CREATE POLICY money_direction_owner_update ON money_direction_rules
    FOR UPDATE USING (profile_id = app.current_profile_id() OR app.is_admin())
    WITH CHECK (profile_id = app.current_profile_id() OR app.is_admin());

CREATE POLICY money_direction_owner_delete ON money_direction_rules
    FOR DELETE USING (profile_id = app.current_profile_id() OR app.is_admin());

-- 5.8 Payment Rails: Public SELECT for checkout discovery (§19); Super Admin write
CREATE POLICY payment_rails_public_select ON payment_rails
    FOR SELECT USING (true);

CREATE POLICY payment_rails_super_admin_write ON payment_rails
    FOR ALL USING (app.is_super_admin())
    WITH CHECK (app.is_super_admin());

-- 5.9 Admin Users: Active Admin SELECT; Super Admin write
CREATE POLICY admin_users_admin_select ON admin_users
    FOR SELECT USING (app.is_admin());

CREATE POLICY admin_users_super_admin_write ON admin_users
    FOR ALL USING (app.is_super_admin())
    WITH CHECK (app.is_super_admin());

-- 5.10 Audit Logs: Admin SELECT; Append-only for authenticated or admin callers
CREATE POLICY audit_logs_admin_select ON audit_logs
    FOR SELECT USING (app.is_admin());

CREATE POLICY audit_logs_insert ON audit_logs
    FOR INSERT WITH CHECK (app.is_admin() OR app.current_clerk_id() IS NOT NULL);

-- 5.11 AI Interactions: Owner SELECT & INSERT
CREATE POLICY ai_interactions_owner_select ON ai_interactions
    FOR SELECT USING (profile_id = app.current_profile_id() OR app.is_admin());

CREATE POLICY ai_interactions_owner_insert ON ai_interactions
    FOR INSERT WITH CHECK (profile_id = app.current_profile_id() OR app.is_admin());

-- 5.12 Reconciliation: Admin only
CREATE POLICY recon_matches_admin_select ON reconciliation_matches
    FOR SELECT USING (app.is_admin());

CREATE POLICY recon_matches_admin_write ON reconciliation_matches
    FOR ALL USING (app.is_admin())
    WITH CHECK (app.is_admin());

CREATE POLICY recon_exceptions_admin_select ON reconciliation_exceptions
    FOR SELECT USING (app.is_admin());

CREATE POLICY recon_exceptions_admin_write ON reconciliation_exceptions
    FOR ALL USING (app.is_admin())
    WITH CHECK (app.is_admin());

-- 5.13 Disputes: Owner SELECT & INSERT; Admin UPDATE
CREATE POLICY disputes_owner_select ON disputes
    FOR SELECT USING (profile_id = app.current_profile_id() OR app.is_admin());

CREATE POLICY disputes_owner_insert ON disputes
    FOR INSERT WITH CHECK (profile_id = app.current_profile_id() OR app.is_admin());

CREATE POLICY disputes_admin_update ON disputes
    FOR UPDATE USING (app.is_admin())
    WITH CHECK (app.is_admin());

-- 5.14 Internal Pipeline Tables: Admin only
CREATE POLICY idempotency_admin_all ON idempotency_records
    FOR ALL USING (app.is_admin())
    WITH CHECK (app.is_admin());

CREATE POLICY webhooks_admin_all ON webhook_events
    FOR ALL USING (app.is_admin())
    WITH CHECK (app.is_admin());

CREATE POLICY outbox_admin_all ON outbox_events
    FOR ALL USING (app.is_admin())
    WITH CHECK (app.is_admin());

-- Register Migration
INSERT INTO _unipay_migrations (name)
VALUES ('0010_row_level_security')
ON CONFLICT (name) DO NOTHING;
