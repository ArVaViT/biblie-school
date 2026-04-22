-- Supabase migration: fix_schema_drift_017
-- Version: 20260421203150

ALTER TABLE public.chapter_progress
  ADD COLUMN IF NOT EXISTS completed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.chapter_progress
  ALTER COLUMN completed_at DROP NOT NULL;

ALTER TABLE public.certificates
  ALTER COLUMN certificate_number DROP NOT NULL;

CREATE INDEX IF NOT EXISTS ix_chapter_progress_completed
  ON public.chapter_progress (completed) WHERE completed = true;
