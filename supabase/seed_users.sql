-- =====================================================================================
-- VAULT 147 POS: PROVISION STAFF & ADMIN USERS IN SUPABASE AUTH
-- Run this script in the Supabase SQL Editor (Dashboard -> SQL Editor -> Run)
-- =====================================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
  admin_id UUID := 'a0000000-0000-0000-0000-000000000001';
  rahul_id UUID := 'a0000000-0000-0000-0000-000000000002';
  priya_id UUID := 'a0000000-0000-0000-0000-000000000003';
BEGIN
  -- -----------------------------------------------------------------------------------
  -- 1. Create or Update Admin: Vikram Sethi (admin@vaultgaming.in)
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
      '{"display_name":"Vikram Sethi (Admin)","role":"admin"}'::jsonb,
      now(), now(), '', '', '', ''
    );
  ELSE
    UPDATE auth.users
    SET encrypted_password = crypt('vault147admin', gen_salt('bf')),
        email_confirmed_at = now()
    WHERE email = 'admin@vaultgaming.in';
  END IF;

  -- -----------------------------------------------------------------------------------
  -- 2. Create or Update Employee: Rahul Sharma (rahul@vaultgaming.in)
  -- Password: vault147staff (also works with password123)
  -- -----------------------------------------------------------------------------------
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'rahul@vaultgaming.in') THEN
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, recovery_sent_at, last_sign_in_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, email_change, email_change_token_new, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      rahul_id,
      'authenticated',
      'authenticated',
      'rahul@vaultgaming.in',
      crypt('vault147staff', gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"display_name":"Rahul Sharma","role":"employee"}'::jsonb,
      now(), now(), '', '', '', ''
    );
  ELSE
    UPDATE auth.users
    SET encrypted_password = crypt('vault147staff', gen_salt('bf')),
        email_confirmed_at = now()
    WHERE email = 'rahul@vaultgaming.in';
  END IF;

  -- -----------------------------------------------------------------------------------
  -- 3. Create or Update Employee: Priya Patel (priya@vaultgaming.in)
  -- Password: vault147staff (also works with password123)
  -- -----------------------------------------------------------------------------------
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'priya@vaultgaming.in') THEN
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, recovery_sent_at, last_sign_in_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, email_change, email_change_token_new, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      priya_id,
      'authenticated',
      'authenticated',
      'priya@vaultgaming.in',
      crypt('vault147staff', gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"display_name":"Priya Patel","role":"employee"}'::jsonb,
      now(), now(), '', '', '', ''
    );
  ELSE
    UPDATE auth.users
    SET encrypted_password = crypt('vault147staff', gen_salt('bf')),
        email_confirmed_at = now()
    WHERE email = 'priya@vaultgaming.in';
  END IF;

  -- -----------------------------------------------------------------------------------
  -- 4. Ensure matching rows in public.profiles table
  -- -----------------------------------------------------------------------------------
  INSERT INTO public.profiles (id, email, display_name, role, is_active)
  VALUES 
    (
      (SELECT id FROM auth.users WHERE email = 'admin@vaultgaming.in'),
      'admin@vaultgaming.in',
      'Vikram Sethi (Admin)',
      'admin',
      true
    ),
    (
      (SELECT id FROM auth.users WHERE email = 'rahul@vaultgaming.in'),
      'rahul@vaultgaming.in',
      'Rahul Sharma',
      'employee',
      true
    ),
    (
      (SELECT id FROM auth.users WHERE email = 'priya@vaultgaming.in'),
      'priya@vaultgaming.in',
      'Priya Patel',
      'employee',
      true
    )
  ON CONFLICT (id) DO UPDATE SET
    role = EXCLUDED.role,
    display_name = EXCLUDED.display_name,
    is_active = EXCLUDED.is_active;

END $$;
