-- =====================================================================================
-- VAULT 147 POS: ENABLE CLOUD SYNC & FIX TABLE PERMISSIONS IN SUPABASE
-- Run this in Supabase SQL Editor (Dashboard -> SQL Editor -> New Query -> Run)
-- Fixes: "permission denied for table sessions"
-- =====================================================================================

-- 1. Grant Schema, Table, & Sequence Privileges to anon and authenticated roles
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO anon, authenticated, service_role;

-- 2. Ensure 'station-walk-in' exists in stations table
INSERT INTO public.stations (id, name, gaming_type, status, display_order)
VALUES ('station-walk-in', 'Walk-in Snack Counter', 'pool', 'available', 99)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, status = 'available';

-- 3. Row Level Security Policies for Sessions
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow create sessions" ON public.sessions;
DROP POLICY IF EXISTS "Employees can create sessions" ON public.sessions;
CREATE POLICY "Allow create sessions" ON public.sessions
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Allow read sessions" ON public.sessions;
DROP POLICY IF EXISTS "Authenticated users can read sessions" ON public.sessions;
CREATE POLICY "Allow read sessions" ON public.sessions
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Allow update sessions" ON public.sessions;
DROP POLICY IF EXISTS "Employees can update active sessions" ON public.sessions;
CREATE POLICY "Allow update sessions" ON public.sessions
  FOR UPDATE TO anon, authenticated USING (true);

-- 4. Row Level Security Policies for Session Items
ALTER TABLE public.session_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow insert session items" ON public.session_items;
DROP POLICY IF EXISTS "Employees can insert session items" ON public.session_items;
CREATE POLICY "Allow insert session items" ON public.session_items
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Allow read session items" ON public.session_items;
DROP POLICY IF EXISTS "Authenticated users can read session items" ON public.session_items;
CREATE POLICY "Allow read session items" ON public.session_items
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Allow update session items" ON public.session_items;
CREATE POLICY "Allow update session items" ON public.session_items
  FOR UPDATE TO anon, authenticated USING (true);

-- 5. Row Level Security Policies for Payments
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow insert payments" ON public.payments;
DROP POLICY IF EXISTS "Employees can insert payments" ON public.payments;
CREATE POLICY "Allow insert payments" ON public.payments
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Allow read payments" ON public.payments;
DROP POLICY IF EXISTS "Authenticated users can read payments" ON public.payments;
CREATE POLICY "Allow read payments" ON public.payments
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Allow update payments" ON public.payments;
DROP POLICY IF EXISTS "Only admins can update or void payments" ON public.payments;
CREATE POLICY "Allow update payments" ON public.payments
  FOR UPDATE TO anon, authenticated USING (true);

-- 6. Row Level Security Policies for Stations
ALTER TABLE public.stations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow read stations" ON public.stations;
DROP POLICY IF EXISTS "Authenticated users can read stations" ON public.stations;
CREATE POLICY "Allow read stations" ON public.stations
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Allow upsert stations" ON public.stations;
CREATE POLICY "Allow upsert stations" ON public.stations
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Allow update stations" ON public.stations;
CREATE POLICY "Allow update stations" ON public.stations
  FOR UPDATE TO anon, authenticated USING (true);

-- 7. Row Level Security Policies for Products
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow read products" ON public.products;
DROP POLICY IF EXISTS "Authenticated users can read products" ON public.products;
CREATE POLICY "Allow read products" ON public.products
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Allow insert products" ON public.products;
CREATE POLICY "Allow insert products" ON public.products
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Allow update products" ON public.products;
CREATE POLICY "Allow update products" ON public.products
  FOR UPDATE TO anon, authenticated USING (true);

-- 8. Row Level Security Policies for Additional Configuration & Audit Tables
ALTER TABLE IF EXISTS public.pricing_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow read pricing_config" ON public.pricing_config;
CREATE POLICY "Allow read pricing_config" ON public.pricing_config FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "Allow write pricing_config" ON public.pricing_config;
CREATE POLICY "Allow write pricing_config" ON public.pricing_config FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.daily_closings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow read daily_closings" ON public.daily_closings;
CREATE POLICY "Allow read daily_closings" ON public.daily_closings FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "Allow write daily_closings" ON public.daily_closings;
CREATE POLICY "Allow write daily_closings" ON public.daily_closings FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow read audit_logs" ON public.audit_logs;
CREATE POLICY "Allow read audit_logs" ON public.audit_logs FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "Allow write audit_logs" ON public.audit_logs;
CREATE POLICY "Allow write audit_logs" ON public.audit_logs FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow read profiles" ON public.profiles;
CREATE POLICY "Allow read profiles" ON public.profiles FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "Allow write profiles" ON public.profiles;
CREATE POLICY "Allow write profiles" ON public.profiles FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
