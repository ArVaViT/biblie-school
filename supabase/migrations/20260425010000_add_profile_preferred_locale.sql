-- Supabase migration: add_profile_preferred_locale
-- Version: 20260425010000
--
-- Adds the per-user UI/content language preference. Default is 'ru' so existing
-- accounts (the original Russian audience) keep behaving the same. The
-- frontend uses this column as the first source of truth on every login,
-- falling back to navigator.language for first-time visitors only.
--
-- The CHECK constraint mirrors the LOCALE_CODES literal in
-- backend/app/schemas/locale.py so the API contract and DB stay in lockstep.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS preferred_locale VARCHAR(8) NOT NULL DEFAULT 'ru';

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_preferred_locale_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_preferred_locale_check
  CHECK (preferred_locale IN ('ru', 'en'));
