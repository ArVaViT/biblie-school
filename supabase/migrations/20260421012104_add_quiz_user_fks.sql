-- Supabase migration: add_quiz_user_fks
-- Version: 20260421012104

ALTER TABLE public.quiz_attempts DROP CONSTRAINT IF EXISTS quiz_attempts_user_id_fkey;
ALTER TABLE public.quiz_attempts ADD CONSTRAINT quiz_attempts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.quiz_extra_attempts DROP CONSTRAINT IF EXISTS quiz_extra_attempts_user_id_fkey;
ALTER TABLE public.quiz_extra_attempts ADD CONSTRAINT quiz_extra_attempts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
