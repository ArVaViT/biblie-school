-- Supabase migration: drop_restrictive_profiles_role_check
-- Version: 20260421205552

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
