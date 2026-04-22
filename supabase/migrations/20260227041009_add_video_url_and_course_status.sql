-- Supabase migration: add_video_url_and_course_status
-- Version: 20260227041009

ALTER TABLE public.chapters ADD COLUMN IF NOT EXISTS video_url text;

ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'draft';

CREATE TABLE IF NOT EXISTS public.chapter_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chapter_id varchar NOT NULL REFERENCES public.chapters(id) ON DELETE CASCADE,
  completed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, chapter_id)
);

ALTER TABLE public.chapter_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_read_own_progress" ON public.chapter_progress
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "users_insert_own_progress" ON public.chapter_progress
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_delete_own_progress" ON public.chapter_progress
  FOR DELETE USING (auth.uid() = user_id);

-- Teachers/admins can read all progress for analytics
CREATE POLICY "teachers_read_all_progress" ON public.chapter_progress
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('teacher', 'admin'))
  );

-- Set existing courses to published
UPDATE public.courses SET status = 'published' WHERE status = 'draft';
