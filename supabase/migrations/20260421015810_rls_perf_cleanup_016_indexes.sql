-- Supabase migration: rls_perf_cleanup_016_indexes
-- Version: 20260421015810

DROP INDEX IF EXISTS public.idx_announcements_course_id;
DROP INDEX IF EXISTS public.idx_assignments_chapter_id;
DROP INDEX IF EXISTS public.idx_chapter_blocks_chapter_id;
DROP INDEX IF EXISTS public.idx_chapter_progress_chapter_id;
DROP INDEX IF EXISTS public.idx_chapter_progress_user_id;
DROP INDEX IF EXISTS public.idx_chapters_module_id;
DROP INDEX IF EXISTS public.idx_reviews_course_id;
DROP INDEX IF EXISTS public.idx_courses_created_by;
DROP INDEX IF EXISTS public.idx_courses_status;
DROP INDEX IF EXISTS public.idx_enrollments_course_id;
DROP INDEX IF EXISTS public.idx_enrollments_user_id;
DROP INDEX IF EXISTS public.idx_modules_course_id;
DROP INDEX IF EXISTS public.idx_quiz_attempts_quiz_id;
DROP INDEX IF EXISTS public.idx_quizzes_chapter_id;
CREATE INDEX IF NOT EXISTS ix_announcements_created_by ON public.announcements (created_by);
CREATE INDEX IF NOT EXISTS ix_assignment_submissions_graded_by ON public.assignment_submissions (graded_by);
CREATE INDEX IF NOT EXISTS ix_certificates_admin_approved_by ON public.certificates (admin_approved_by);
CREATE INDEX IF NOT EXISTS ix_certificates_cohort_id ON public.certificates (cohort_id);
CREATE INDEX IF NOT EXISTS ix_certificates_course_id ON public.certificates (course_id);
CREATE INDEX IF NOT EXISTS ix_certificates_teacher_approved_by ON public.certificates (teacher_approved_by);
CREATE INDEX IF NOT EXISTS ix_chapter_blocks_assignment_id ON public.chapter_blocks (assignment_id);
CREATE INDEX IF NOT EXISTS ix_chapter_blocks_quiz_id ON public.chapter_blocks (quiz_id);
CREATE INDEX IF NOT EXISTS ix_chapter_progress_completed_by ON public.chapter_progress (completed_by);
CREATE INDEX IF NOT EXISTS ix_course_prerequisites_prerequisite_course_id ON public.course_prerequisites (prerequisite_course_id);
CREATE INDEX IF NOT EXISTS ix_quiz_answers_question_id ON public.quiz_answers (question_id);
CREATE INDEX IF NOT EXISTS ix_quiz_answers_selected_option_id ON public.quiz_answers (selected_option_id);
CREATE INDEX IF NOT EXISTS ix_quiz_extra_attempts_user_id ON public.quiz_extra_attempts (user_id);
CREATE INDEX IF NOT EXISTS ix_student_grades_cohort_id ON public.student_grades (cohort_id);
CREATE INDEX IF NOT EXISTS ix_student_grades_graded_by ON public.student_grades (graded_by);
