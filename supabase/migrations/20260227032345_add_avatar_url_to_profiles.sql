-- Supabase migration: add_avatar_url_to_profiles
-- Version: 20260227032345

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url text;
