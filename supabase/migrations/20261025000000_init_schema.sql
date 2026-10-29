-- ======================================================================================
-- VAULT GAMING CENTRE & POOL LOUNGE - PRODUCTION DATABASE SCHEMA (IDEMPOTENT)
-- Target Database: PostgreSQL 15+ (Supabase)
-- All financial amounts are stored as exact INTEGER PAISE (1 INR = 100 paise)
-- Row Level Security (RLS) is strictly enforced on all tables
-- Safe to re-run multiple times without duplicate errors
-- ======================================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. PROFILES & ROLES
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('admin', 'employee');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'employee',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Helper function to check if current authenticated user is an active admin
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

-- Profiles Policies
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
CREATE POLICY "Users can read own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can insert and update profiles" ON public.profiles;
CREATE POLICY "Admins can insert and update profiles" ON public.profiles
  FOR ALL USING (public.is_admin());

-- Auto-provision profile row whenever a new user is created in Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'employee')
  )
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email,
      display_name = COALESCE(EXCLUDED.display_name, public.profiles.display_name);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. STATIONS (PS5 consoles and 8-Ball Pool tables)
DO $$ BEGIN
  CREATE TYPE gaming_type AS ENUM ('ps5', 'pool');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE station_status AS ENUM ('available', 'occupied', 'maintenance');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS public.stations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  gaming_type gaming_type NOT NULL,
  status station_status NOT NULL DEFAULT 'available',
  active_session_id TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.stations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read stations" ON public.stations;
CREATE POLICY "Authenticated users can read stations" ON public.stations
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Employees can update station status" ON public.stations;
CREATE POLICY "Employees can update station status" ON public.stations
  FOR UPDATE TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins can manage stations" ON public.stations;
CREATE POLICY "Admins can manage stations" ON public.stations
  FOR ALL TO authenticated USING (public.is_admin());

-- 3. PRICING & BUSINESS CONFIGURATION
CREATE TABLE IF NOT EXISTS public.pricing_config (
  id TEXT PRIMARY KEY DEFAULT 'cfg-default',
  business_name TEXT NOT NULL DEFAULT 'Vault Gaming Centre',
  business_timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  currency_symbol TEXT NOT NULL DEFAULT '₹',
  ps5_hourly_rate_paise INTEGER NOT NULL DEFAULT 15000, -- ₹150.00
  ps5_multiplayer_hourly_rate_paise INTEGER NOT NULL DEFAULT 22000, -- ₹220.00
  ps5_fixed_plans JSONB NOT NULL DEFAULT '[]'::jsonb,
  pool_hourly_rate_paise INTEGER NOT NULL DEFAULT 18000, -- ₹180.00
  pool_per_frame_rate_paise INTEGER NOT NULL DEFAULT 5000, -- ₹50.00
  rounding_rule TEXT NOT NULL DEFAULT 'nearest_5',
  allow_custom_snacks BOOLEAN NOT NULL DEFAULT true,
  allow_partial_payments BOOLEAN NOT NULL DEFAULT true,
  max_employee_discount_paise INTEGER NOT NULL DEFAULT 5000, -- ₹50.00
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.pricing_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read pricing" ON public.pricing_config;
CREATE POLICY "Authenticated users can read pricing" ON public.pricing_config
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Only admins can update pricing" ON public.pricing_config;
CREATE POLICY "Only admins can update pricing" ON public.pricing_config
  FOR UPDATE TO authenticated USING (public.is_admin());

-- 4. SNACK CATALOGUE (PRODUCTS)
CREATE TABLE IF NOT EXISTS public.products (
  id TEXT PRIMARY KEY DEFAULT ('snk-' || extract(epoch from now())::text),
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'General',
  price_paise INTEGER NOT NULL CHECK (price_paise >= 0),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read products" ON public.products;
CREATE POLICY "Authenticated users can read products" ON public.products
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Only admins can manage products" ON public.products;
CREATE POLICY "Only admins can manage products" ON public.products
  FOR ALL TO authenticated USING (public.is_admin());

-- 5. SESSIONS
DO $$ BEGIN
  CREATE TYPE billing_type AS ENUM ('hourly', 'fixed');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE session_status AS ENUM ('active', 'completed', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS public.sessions (
  id TEXT PRIMARY KEY DEFAULT ('sess-' || extract(epoch from now())::text),
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  gaming_type gaming_type NOT NULL,
  station_id TEXT NOT NULL REFERENCES public.stations(id),
  station_name TEXT NOT NULL,
  billing_type billing_type NOT NULL,
  is_multiplayer BOOLEAN NOT NULL DEFAULT false,
  fixed_plan_id TEXT,
  fixed_plan_name TEXT,
  frames_count INTEGER DEFAULT 1,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ,
  duration_minutes INTEGER,
  status session_status NOT NULL DEFAULT 'active',
  rate_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  gaming_charge_paise INTEGER NOT NULL DEFAULT 0 CHECK (gaming_charge_paise >= 0),
  snack_subtotal_paise INTEGER NOT NULL DEFAULT 0 CHECK (snack_subtotal_paise >= 0),
  discount_paise INTEGER NOT NULL DEFAULT 0 CHECK (discount_paise >= 0),
  discount_reason TEXT,
  final_bill_paise INTEGER NOT NULL DEFAULT 0 CHECK (final_bill_paise >= 0),
  created_by UUID REFERENCES public.profiles(id),
  created_by_name TEXT NOT NULL,
  completed_by UUID REFERENCES public.profiles(id),
  completed_by_name TEXT,
  notes TEXT,
  is_voided BOOLEAN NOT NULL DEFAULT false,
  void_reason TEXT,
  voided_by UUID REFERENCES public.profiles(id),
  voided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_sessions_start_time ON public.sessions(start_time);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON public.sessions(status);
CREATE INDEX IF NOT EXISTS idx_sessions_station ON public.sessions(station_id);

ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read sessions" ON public.sessions;
CREATE POLICY "Authenticated users can read sessions" ON public.sessions
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Employees can create sessions" ON public.sessions;
CREATE POLICY "Employees can create sessions" ON public.sessions
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Employees can update active sessions" ON public.sessions;
CREATE POLICY "Employees can update active sessions" ON public.sessions
  FOR UPDATE TO authenticated USING (
    status = 'active' OR public.is_admin()
  );

-- 6. SESSION ITEMS (SNACK LINE ITEMS WITH HISTORICAL SNAPSHOT)
CREATE TABLE IF NOT EXISTS public.session_items (
  id TEXT PRIMARY KEY DEFAULT ('item-' || extract(epoch from now())::text || '-' || floor(random() * 1000)::text),
  session_id TEXT NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  product_id TEXT REFERENCES public.products(id),
  name TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price_paise INTEGER NOT NULL CHECK (unit_price_paise >= 0),
  line_total_paise INTEGER NOT NULL CHECK (line_total_paise >= 0),
  is_custom BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_session_items_session ON public.session_items(session_id);

ALTER TABLE public.session_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read session items" ON public.session_items;
CREATE POLICY "Authenticated users can read session items" ON public.session_items
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Employees can insert session items" ON public.session_items;
CREATE POLICY "Employees can insert session items" ON public.session_items
  FOR INSERT TO authenticated WITH CHECK (true);

-- 7. PAYMENTS
DO $$ BEGIN
  CREATE TYPE payment_method AS ENUM ('gpay', 'cash', 'split');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE payment_status AS ENUM ('PAID', 'PARTIAL', 'UNPAID', 'VOIDED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS public.payments (
  id TEXT PRIMARY KEY DEFAULT ('pay-' || extract(epoch from now())::text),
  session_id TEXT NOT NULL REFERENCES public.sessions(id) ON DELETE RESTRICT,
  method payment_method NOT NULL,
  gpay_amount_paise INTEGER NOT NULL DEFAULT 0 CHECK (gpay_amount_paise >= 0),
  cash_amount_paise INTEGER NOT NULL DEFAULT 0 CHECK (cash_amount_paise >= 0),
  total_received_paise INTEGER NOT NULL DEFAULT 0 CHECK (total_received_paise >= 0),
  final_bill_paise INTEGER NOT NULL DEFAULT 0 CHECK (final_bill_paise >= 0),
  outstanding_balance_paise INTEGER NOT NULL DEFAULT 0 CHECK (outstanding_balance_paise >= 0),
  recorded_by UUID REFERENCES public.profiles(id),
  recorded_by_name TEXT NOT NULL,
  status payment_status NOT NULL DEFAULT 'PAID',
  notes TEXT,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read payments" ON public.payments;
CREATE POLICY "Authenticated users can read payments" ON public.payments
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Employees can insert payments" ON public.payments;
CREATE POLICY "Employees can insert payments" ON public.payments
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Only admins can update or void payments" ON public.payments;
CREATE POLICY "Only admins can update or void payments" ON public.payments
  FOR UPDATE TO authenticated USING (public.is_admin());

-- 8. DAILY CLOSINGS (CASH RECONCILIATION)
CREATE TABLE IF NOT EXISTS public.daily_closings (
  id TEXT PRIMARY KEY DEFAULT ('close-' || extract(epoch from now())::text),
  closing_date DATE NOT NULL UNIQUE,
  expected_cash_paise INTEGER NOT NULL,
  counted_cash_paise INTEGER NOT NULL,
  cash_variance_paise INTEGER NOT NULL,
  gpay_total_paise INTEGER NOT NULL,
  total_sales_paise INTEGER NOT NULL,
  denominations JSONB NOT NULL,
  notes TEXT,
  closed_by UUID REFERENCES public.profiles(id),
  closed_by_name TEXT NOT NULL,
  closed_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.daily_closings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read daily closings" ON public.daily_closings;
CREATE POLICY "Authenticated users can read daily closings" ON public.daily_closings
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Employees and admins can insert daily closings" ON public.daily_closings;
CREATE POLICY "Employees and admins can insert daily closings" ON public.daily_closings
  FOR INSERT TO authenticated WITH CHECK (true);

-- 9. AUDIT LOGS (IMMUTABLE)
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id TEXT PRIMARY KEY DEFAULT ('log-' || extract(epoch from now())::text),
  actor_id TEXT NOT NULL,
  actor_name TEXT NOT NULL,
  actor_role user_role NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  details TEXT NOT NULL,
  previous_state JSONB,
  new_state JSONB,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON public.audit_logs(timestamp);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Only admins can read audit logs" ON public.audit_logs;
CREATE POLICY "Only admins can read audit logs" ON public.audit_logs
  FOR SELECT TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "System and employees can insert audit logs" ON public.audit_logs;
CREATE POLICY "System and employees can insert audit logs" ON public.audit_logs
  FOR INSERT TO authenticated WITH CHECK (true);

-- Prevent deletes or updates on audit logs
CREATE OR REPLACE FUNCTION prevent_audit_log_modification()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Audit logs are strictly immutable and cannot be updated or deleted.';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_protect_audit_logs ON public.audit_logs;
CREATE TRIGGER trg_protect_audit_logs
BEFORE UPDATE OR DELETE ON public.audit_logs
FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_modification();
