-- Supabase migration: add_teacher_approval_and_grades
-- Version: 20260227045129

-- 1. Create grades table for teacher gradebook
CREATE TABLE IF NOT EXISTS public.student_grades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id varchar NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  grade varchar(10),
  comment text,
  graded_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  graded_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(student_id, course_id)
);

ALTER TABLE public.student_grades ENABLE ROW LEVEL SECURITY;

-- Students can read their own grades
CREATE POLICY "students_read_own_grades" ON public.student_grades
  FOR SELECT USING (auth.uid() = student_id);

-- Teachers/admins can read all grades
CREATE POLICY "teachers_read_all_grades" ON public.student_grades
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('teacher', 'admin'))
  );

-- Teachers/admins can insert grades
CREATE POLICY "teachers_insert_grades" ON public.student_grades
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('teacher', 'admin'))
  );

-- Teachers/admins can update grades
CREATE POLICY "teachers_update_grades" ON public.student_grades
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('teacher', 'admin'))
  );

-- Teachers/admins can delete grades
CREATE POLICY "teachers_delete_grades" ON public.student_grades
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('teacher', 'admin'))
  );

-- 2. Update handle_new_user trigger: teachers get 'pending_teacher' role
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    CASE
      WHEN COALESCE(NEW.raw_user_meta_data->>'role', 'student') = 'teacher'
      THEN 'pending_teacher'
      ELSE COALESCE(NEW.raw_user_meta_data->>'role', 'student')
    END
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    full_name = CASE WHEN EXCLUDED.full_name <> '' THEN EXCLUDED.full_name ELSE public.profiles.full_name END;
  RETURN NEW;
END;
$$;
