-- =====================================================================================
-- VAULT 147 POS: ENABLE CLOUD SYNC & AUTO-CALCULATED DECIMAL RUPEES IN SUPABASE
-- Run this in Supabase SQL Editor (Dashboard -> SQL Editor -> New Query -> Run)
-- Adds: Decimal columns (e.g. 150.00 instead of 15000 paise) + Clean Decimal View
-- =====================================================================================

-- 1. Grant Schema, Table, & Sequence Privileges to anon and authenticated roles
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO anon, authenticated, service_role;

-- 2. Seed all gaming stations and walk-in counter to satisfy foreign key constraints
INSERT INTO public.stations (id, name, gaming_type, status, display_order) VALUES
('ps5-1', 'PS5 Station 1', 'ps5', 'available', 1),
('ps5-2', 'PS5 Station 2', 'ps5', 'available', 2),
('ps5-3', 'PS5 Station 3', 'ps5', 'available', 3),
('pool-1', 'Snooker Table 1', 'pool', 'available', 4),
('pool-2', 'Snooker Table 2', 'pool', 'available', 5),
('pool-3', 'Snooker Table 3', 'pool', 'available', 6),
('station-walk-in', 'Walk-in Snack Counter', 'pool', 'available', 99)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, gaming_type = EXCLUDED.gaming_type;

-- 3. Seed all products (snacks and beverages)
INSERT INTO public.products (id, name, category, price_paise, is_active) VALUES
('snk-1', 'Red Bull Energy Drink (250ml)', 'Beverages', 12500, true),
('snk-2', 'Mountain Dew Can (300ml)', 'Beverages', 4000, true),
('snk-3', 'Coca-Cola Zero Can (300ml)', 'Beverages', 4000, true),
('snk-4', 'Kinley Mineral Water (500ml)', 'Beverages', 2000, true),
('snk-5', 'Lay''s Magic Masala (Large)', 'Chips & Savouries', 3000, true),
('snk-6', 'Doritos Cheese Supreme (75g)', 'Chips & Savouries', 5000, true),
('snk-7', 'Snickers Chocolate Bar', 'Chocolates', 5000, true),
('snk-8', 'Maggi Masala Double Bowl', 'Hot Items', 6000, true)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, price_paise = EXCLUDED.price_paise;

-- 4. Drop restrictive legacy triggers that block cloud sync of completed sessions
DROP TRIGGER IF EXISTS trg_validate_session_update ON public.sessions;
DROP TRIGGER IF EXISTS trg_validate_session_integrity ON public.sessions;

-- 5. Row Level Security Policies for Sessions
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

-- 5. Row Level Security Policies for Session Items
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

-- 6. Row Level Security Policies for Payments
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

-- 7. Row Level Security Policies for Stations
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

-- 8. Row Level Security Policies for Products
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

-- 9. Row Level Security Policies for Additional Configuration & Audit Tables
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

-- -------------------------------------------------------------------------------------
-- 10. AUTO-GENERATED DECIMAL RUPEES COLUMNS (e.g. 150.00 instead of 15000)
-- PostgreSQL automatically computes and stores these whenever rows are inserted or synced.
-- -------------------------------------------------------------------------------------

-- Sessions: Add decimal columns
ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS final_bill_rupees NUMERIC(10,2) GENERATED ALWAYS AS (final_bill_paise::numeric / 100.0) STORED,
  ADD COLUMN IF NOT EXISTS gaming_charge_rupees NUMERIC(10,2) GENERATED ALWAYS AS (gaming_charge_paise::numeric / 100.0) STORED,
  ADD COLUMN IF NOT EXISTS snack_subtotal_rupees NUMERIC(10,2) GENERATED ALWAYS AS (snack_subtotal_paise::numeric / 100.0) STORED,
  ADD COLUMN IF NOT EXISTS discount_rupees NUMERIC(10,2) GENERATED ALWAYS AS (discount_paise::numeric / 100.0) STORED;

-- Payments: Add decimal columns
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS final_bill_rupees NUMERIC(10,2) GENERATED ALWAYS AS (final_bill_paise::numeric / 100.0) STORED,
  ADD COLUMN IF NOT EXISTS total_received_rupees NUMERIC(10,2) GENERATED ALWAYS AS (total_received_paise::numeric / 100.0) STORED,
  ADD COLUMN IF NOT EXISTS gpay_amount_rupees NUMERIC(10,2) GENERATED ALWAYS AS (gpay_amount_paise::numeric / 100.0) STORED,
  ADD COLUMN IF NOT EXISTS cash_amount_rupees NUMERIC(10,2) GENERATED ALWAYS AS (cash_amount_paise::numeric / 100.0) STORED,
  ADD COLUMN IF NOT EXISTS outstanding_balance_rupees NUMERIC(10,2) GENERATED ALWAYS AS (outstanding_balance_paise::numeric / 100.0) STORED;

-- Products: Add decimal price column
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS price_rupees NUMERIC(10,2) GENERATED ALWAYS AS (price_paise::numeric / 100.0) STORED;

-- Session Items: Add decimal price and total columns
ALTER TABLE public.session_items
  ADD COLUMN IF NOT EXISTS unit_price_rupees NUMERIC(10,2) GENERATED ALWAYS AS (unit_price_paise::numeric / 100.0) STORED,
  ADD COLUMN IF NOT EXISTS line_total_rupees NUMERIC(10,2) GENERATED ALWAYS AS (line_total_paise::numeric / 100.0) STORED;

-- -------------------------------------------------------------------------------------
-- 11. USER-FRIENDLY DECIMAL VIEW FOR SUPABASE TABLE EDITOR
-- Appears under "Views" in Supabase with clean ₹ currency values
-- -------------------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.sessions_decimal_view AS
SELECT
  s.id AS session_id,
  s.customer_name,
  s.customer_phone,
  s.gaming_type,
  s.station_name,
  s.billing_type,
  s.start_time,
  s.end_time,
  s.duration_minutes,
  s.status,
  (s.gaming_charge_paise::numeric / 100.0) AS gaming_charge_rupees,
  (s.snack_subtotal_paise::numeric / 100.0) AS snack_subtotal_rupees,
  (s.discount_paise::numeric / 100.0) AS discount_rupees,
  (s.final_bill_paise::numeric / 100.0) AS final_bill_rupees,
  p.method AS payment_method,
  (COALESCE(p.gpay_amount_paise, 0)::numeric / 100.0) AS gpay_paid_rupees,
  (COALESCE(p.cash_amount_paise, 0)::numeric / 100.0) AS cash_paid_rupees,
  (COALESCE(p.total_received_paise, 0)::numeric / 100.0) AS total_received_rupees,
  (COALESCE(p.outstanding_balance_paise, 0)::numeric / 100.0) AS outstanding_rupees,
  s.created_by_name AS staff_name,
  s.created_at
FROM public.sessions s
LEFT JOIN public.payments p ON p.session_id = s.id
ORDER BY s.created_at DESC;

GRANT SELECT ON public.sessions_decimal_view TO anon, authenticated, service_role;
