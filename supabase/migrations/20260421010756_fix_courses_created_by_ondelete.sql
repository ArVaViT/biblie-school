-- Supabase migration: fix_courses_created_by_ondelete
-- Version: 20260421010756

-- Phase 0.5: fix FK drift on public.courses.created_by
-- Model says ON DELETE SET NULL but DB had ON DELETE CASCADE.
-- CASCADE would silently wipe every course a teacher created if their
-- profile row is deleted directly (bypassing the application cleanup path
-- in users.py, which already nullifies created_by first).

ALTER TABLE public.courses
  DROP CONSTRAINT IF EXISTS courses_created_by_fkey;

ALTER TABLE public.courses
  ADD CONSTRAINT courses_created_by_fkey
  FOREIGN KEY (created_by)
  REFERENCES public.profiles(id)
  ON DELETE SET NULL;
