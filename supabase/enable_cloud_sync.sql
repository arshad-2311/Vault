-- =====================================================================================
-- VAULT 147 POS: ENABLE CLOUD SYNC & WALK-IN COUNTER IN SUPABASE
-- Run this in Supabase SQL Editor (Dashboard -> SQL Editor -> Run)
-- =====================================================================================

-- 1. Ensure 'station-walk-in' exists in stations table
INSERT INTO public.stations (id, name, gaming_type, status, display_order)
VALUES ('station-walk-in', 'Walk-in Snack Counter', 'pool', 'available', 99)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, status = 'available';

-- 2. Allow both authenticated and anon roles to record sessions
DROP POLICY IF EXISTS "Employees can create sessions" ON public.sessions;
DROP POLICY IF EXISTS "Allow create sessions" ON public.sessions;
CREATE POLICY "Allow create sessions" ON public.sessions
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can read sessions" ON public.sessions;
DROP POLICY IF EXISTS "Allow read sessions" ON public.sessions;
CREATE POLICY "Allow read sessions" ON public.sessions
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Employees can update active sessions" ON public.sessions;
DROP POLICY IF EXISTS "Allow update sessions" ON public.sessions;
CREATE POLICY "Allow update sessions" ON public.sessions
  FOR UPDATE TO anon, authenticated USING (true);

-- 3. Allow recording session items (snacks / drinks)
DROP POLICY IF EXISTS "Employees can insert session items" ON public.session_items;
DROP POLICY IF EXISTS "Allow insert session items" ON public.session_items;
CREATE POLICY "Allow insert session items" ON public.session_items
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can read session items" ON public.session_items;
DROP POLICY IF EXISTS "Allow read session items" ON public.session_items;
CREATE POLICY "Allow read session items" ON public.session_items
  FOR SELECT TO anon, authenticated USING (true);

-- 4. Allow recording payments
DROP POLICY IF EXISTS "Employees can insert payments" ON public.payments;
DROP POLICY IF EXISTS "Allow insert payments" ON public.payments;
CREATE POLICY "Allow insert payments" ON public.payments
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can read payments" ON public.payments;
DROP POLICY IF EXISTS "Allow read payments" ON public.payments;
CREATE POLICY "Allow read payments" ON public.payments
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Only admins can update or void payments" ON public.payments;
DROP POLICY IF EXISTS "Allow update payments" ON public.payments;
CREATE POLICY "Allow update payments" ON public.payments
  FOR UPDATE TO anon, authenticated USING (true);

-- 5. Allow reading stations and products
DROP POLICY IF EXISTS "Authenticated users can read stations" ON public.stations;
DROP POLICY IF EXISTS "Allow read stations" ON public.stations;
CREATE POLICY "Allow read stations" ON public.stations
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can read products" ON public.products;
DROP POLICY IF EXISTS "Allow read products" ON public.products;
CREATE POLICY "Allow read products" ON public.products
  FOR SELECT TO anon, authenticated USING (true);
