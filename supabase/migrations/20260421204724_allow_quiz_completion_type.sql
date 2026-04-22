-- Supabase migration: allow_quiz_completion_type
-- Version: 20260421204724

ALTER TABLE public.chapter_progress DROP CONSTRAINT IF EXISTS chapter_progress_completion_type_check; ALTER TABLE public.chapter_progress ADD CONSTRAINT chapter_progress_completion_type_check CHECK (completion_type IN ('self','teacher','quiz'));
