-- ======================================================================================
-- VAULT GAMING CENTRE & POOL LOUNGE - SECURITY HARDENING MIGRATION
-- Migration: 20261028000000_security_hardening.sql
-- Purpose: Strict backend Row Level Security (RLS), Immutability Guarantees, Role Checks
-- ======================================================================================

-- 1. Re-declare is_admin() with explicit search_path to prevent search-path hijacking CVE
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'admin'
      AND is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- 2. Ensure Row Level Security is enabled on every single public table
ALTER TABLE IF EXISTS public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.stations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.pricing_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.session_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.daily_closings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.audit_logs ENABLE ROW LEVEL SECURITY;

-- 3. Explicitly revoke all privileges from unauthenticated (anon) users on business tables
REVOKE ALL ON TABLE public.profiles FROM anon;
REVOKE ALL ON TABLE public.stations FROM anon;
REVOKE ALL ON TABLE public.pricing_config FROM anon;
REVOKE ALL ON TABLE public.products FROM anon;
REVOKE ALL ON TABLE public.sessions FROM anon;
REVOKE ALL ON TABLE public.session_items FROM anon;
REVOKE ALL ON TABLE public.payments FROM anon;
REVOKE ALL ON TABLE public.daily_closings FROM anon;
REVOKE ALL ON TABLE public.audit_logs FROM anon;

-- 4. Prevent DELETION of financial records (sessions and payments) by ANY role
CREATE OR REPLACE FUNCTION public.prevent_financial_record_deletion()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Security Violation: Historical financial records (sessions and payments) are immutable and cannot be deleted.';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_prevent_session_deletion ON public.sessions;
CREATE TRIGGER trg_prevent_session_deletion
BEFORE DELETE ON public.sessions
FOR EACH ROW EXECUTE FUNCTION public.prevent_financial_record_deletion();

DROP TRIGGER IF EXISTS trg_prevent_payment_deletion ON public.payments;
CREATE TRIGGER trg_prevent_payment_deletion
BEFORE DELETE ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.prevent_financial_record_deletion();

-- 5. Prevent direct modification of completed sessions by employees
CREATE OR REPLACE FUNCTION public.validate_session_update_security()
RETURNS TRIGGER AS $$
BEGIN
  -- If session was already completed or cancelled, only active admins can update or void
  IF OLD.status IN ('completed', 'cancelled') AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Security Violation: Finalized sessions cannot be modified by employees. Administrator credentials required.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_validate_session_update ON public.sessions;
CREATE TRIGGER trg_validate_session_update
BEFORE UPDATE ON public.sessions
FOR EACH ROW EXECUTE FUNCTION public.validate_session_update_security();

-- 6. Prevent column tampering during session completion (rates, line items, author, start time)
CREATE OR REPLACE FUNCTION public.validate_session_integrity()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT public.is_admin() THEN
    IF OLD.rate_snapshot IS DISTINCT FROM NEW.rate_snapshot THEN
      RAISE EXCEPTION 'Security Violation: Employees cannot alter historical rate snapshots.';
    END IF;
    IF OLD.created_by IS DISTINCT FROM NEW.created_by THEN
      RAISE EXCEPTION 'Security Violation: Session author cannot be reassigned.';
    END IF;
    IF OLD.start_time IS DISTINCT FROM NEW.start_time THEN
      RAISE EXCEPTION 'Security Violation: Session start time cannot be modified retroactively.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_validate_session_integrity ON public.sessions;
CREATE TRIGGER trg_validate_session_integrity
BEFORE UPDATE ON public.sessions
FOR EACH ROW EXECUTE FUNCTION public.validate_session_integrity();

-- 7. Ensure audit logs are strictly append-only
CREATE OR REPLACE FUNCTION public.prevent_audit_log_modification()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Security Violation: Audit logs are strictly immutable and cannot be updated or deleted.';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_protect_audit_logs ON public.audit_logs;
CREATE TRIGGER trg_protect_audit_logs
BEFORE UPDATE OR DELETE ON public.audit_logs
FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_log_modification();

-- 8. Ensure only admins can read audit logs
DROP POLICY IF EXISTS "Only admins can read audit logs" ON public.audit_logs;
CREATE POLICY "Only admins can read audit logs" ON public.audit_logs
  FOR SELECT TO authenticated USING (public.is_admin());

-- 9. Allow employees to update active sessions and transition to completed (Fixes RLS checkout bug)
DROP POLICY IF EXISTS "Employees can update active sessions" ON public.sessions;
CREATE POLICY "Employees can update active sessions" ON public.sessions
  FOR UPDATE TO authenticated
  USING (
    status = 'active' OR public.is_admin()
  )
  WITH CHECK (
    (status IN ('active', 'completed') AND NOT is_voided) OR public.is_admin()
  );

-- 10. Prevent payment modification or deletion by employees
DROP POLICY IF EXISTS "Only admins can update or void payments" ON public.payments;
CREATE POLICY "Only admins can update or void payments" ON public.payments
  FOR UPDATE TO authenticated USING (public.is_admin());

-- 11. Allow staff to read active profiles for display on active sessions
DROP POLICY IF EXISTS "Staff can read active profiles" ON public.profiles;
CREATE POLICY "Staff can read active profiles" ON public.profiles
  FOR SELECT TO authenticated USING (is_active = true);
