-- =====================================================================================
-- VAULT 147 POS: PROVISION ADMIN USER IN SUPABASE AUTH (ADMIN ONLY)
-- Run this script in the Supabase SQL Editor (Dashboard -> SQL Editor -> Run)
-- =====================================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
  admin_id UUID := 'a0000000-0000-0000-0000-000000000001';
BEGIN
  -- -----------------------------------------------------------------------------------
  -- 1. Create or Update Admin: Ruwaidh (admin@vaultgaming.in)
  -- Password: vault147admin (also works with password123)
  -- -----------------------------------------------------------------------------------
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'admin@vaultgaming.in') THEN
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, recovery_sent_at, last_sign_in_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, email_change, email_change_token_new, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      admin_id,
      'authenticated',
      'authenticated',
      'admin@vaultgaming.in',
      crypt('vault147admin', gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"display_name":"Ruwaidh (Admin)","role":"admin"}'::jsonb,
      now(), now(), '', '', '', ''
    );
  ELSE
    UPDATE auth.users
    SET encrypted_password = crypt('vault147admin', gen_salt('bf')),
        email_confirmed_at = now()
    WHERE email = 'admin@vaultgaming.in';
  END IF;

  -- -----------------------------------------------------------------------------------
  -- 2. Ensure matching row in public.profiles table
  -- -----------------------------------------------------------------------------------
  INSERT INTO public.profiles (id, email, display_name, role, is_active)
  VALUES 
    (
      (SELECT id FROM auth.users WHERE email = 'admin@vaultgaming.in'),
      'admin@vaultgaming.in',
      'Ruwaidh (Admin)',
      'admin',
      true
    )
  ON CONFLICT (id) DO UPDATE SET
    role = EXCLUDED.role,
    display_name = EXCLUDED.display_name,
    is_active = EXCLUDED.is_active;

END $$;


