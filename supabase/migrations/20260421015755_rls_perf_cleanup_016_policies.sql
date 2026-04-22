-- Supabase migration: rls_perf_cleanup_016_policies
-- Version: 20260421015755

CREATE POLICY "announcements_select_authenticated" ON public.announcements
FOR SELECT TO authenticated
USING ((SELECT auth.uid()) IS NOT NULL);
CREATE POLICY "announcements_insert_teacher" ON public.announcements
FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = (SELECT auth.uid()) AND p.role = ANY (ARRAY['teacher'::text, 'admin'::text])));
CREATE POLICY "announcements_update_own" ON public.announcements
FOR UPDATE TO authenticated
USING (created_by = (SELECT auth.uid()) OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = (SELECT auth.uid()) AND p.role = 'admin'::text));
CREATE POLICY "announcements_delete_own" ON public.announcements
FOR DELETE TO authenticated
USING (created_by = (SELECT auth.uid()) OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = (SELECT auth.uid()) AND p.role = 'admin'::text));
CREATE POLICY "submissions_select_own_or_teacher" ON public.assignment_submissions
FOR SELECT TO authenticated
USING (student_id = (SELECT auth.uid()) OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = (SELECT auth.uid()) AND p.role = ANY (ARRAY['teacher'::text, 'admin'::text])));
CREATE POLICY "submissions_insert_own" ON public.assignment_submissions
FOR INSERT TO authenticated
WITH CHECK (student_id = (SELECT auth.uid()));
CREATE POLICY "submissions_update_teacher" ON public.assignment_submissions
FOR UPDATE TO authenticated
USING (student_id = (SELECT auth.uid()) OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = (SELECT auth.uid()) AND p.role = ANY (ARRAY['teacher'::text, 'admin'::text])));
CREATE POLICY "assignments_select_all" ON public.assignments
FOR SELECT TO authenticated
USING ((SELECT auth.uid()) IS NOT NULL);
CREATE POLICY "assignments_insert_teacher" ON public.assignments
FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = (SELECT auth.uid()) AND p.role = ANY (ARRAY['teacher'::text, 'admin'::text])));
CREATE POLICY "assignments_update_teacher" ON public.assignments
FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = (SELECT auth.uid()) AND p.role = ANY (ARRAY['teacher'::text, 'admin'::text])));
CREATE POLICY "assignments_delete_teacher" ON public.assignments
FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = (SELECT auth.uid()) AND p.role = ANY (ARRAY['teacher'::text, 'admin'::text])));
CREATE POLICY "audit_logs_select_admin" ON public.audit_logs
FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = (SELECT auth.uid()) AND p.role = 'admin'::text));
CREATE POLICY "certificates_select_own_or_teacher" ON public.certificates
FOR SELECT TO authenticated
USING (user_id = (SELECT auth.uid()) OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = (SELECT auth.uid()) AND p.role = ANY (ARRAY['teacher'::text, 'admin'::text])));
CREATE POLICY "certificates_insert_request" ON public.certificates
FOR INSERT TO authenticated
WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY "certificates_update_approval" ON public.certificates
FOR UPDATE TO authenticated
USING (user_id = (SELECT auth.uid()) OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = (SELECT auth.uid()) AND p.role = ANY (ARRAY['teacher'::text, 'admin'::text])));
CREATE POLICY "blocks_select_all" ON public.chapter_blocks
FOR SELECT TO authenticated
USING ((SELECT auth.uid()) IS NOT NULL);
CREATE POLICY "blocks_insert_teacher" ON public.chapter_blocks
FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = (SELECT auth.uid()) AND p.role = ANY (ARRAY['teacher'::text, 'admin'::text])));
CREATE POLICY "blocks_update_teacher" ON public.chapter_blocks
FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = (SELECT auth.uid()) AND p.role = ANY (ARRAY['teacher'::text, 'admin'::text])));
CREATE POLICY "blocks_delete_teacher" ON public.chapter_blocks
FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = (SELECT auth.uid()) AND p.role = ANY (ARRAY['teacher'::text, 'admin'::text])));
CREATE POLICY "chapters_select_public" ON public.chapters
FOR SELECT TO authenticated
USING (true);
CREATE POLICY "chapters_insert_teacher" ON public.chapters
FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = (SELECT auth.uid()) AND p.role = ANY (ARRAY['teacher'::text, 'admin'::text])));
CREATE POLICY "chapters_update_teacher" ON public.chapters
FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = (SELECT auth.uid()) AND p.role = ANY (ARRAY['teacher'::text, 'admin'::text])));
CREATE POLICY "chapters_delete_teacher" ON public.chapters
FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = (SELECT auth.uid()) AND p.role = ANY (ARRAY['teacher'::text, 'admin'::text])));
CREATE POLICY "chapter_progress_select" ON public.chapter_progress
FOR SELECT TO authenticated
USING (user_id = (SELECT auth.uid()) OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = (SELECT auth.uid()) AND p.role = ANY (ARRAY['teacher'::text, 'admin'::text])));
CREATE POLICY "chapter_progress_insert_own" ON public.chapter_progress
FOR INSERT TO authenticated
WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY "chapter_progress_update_own" ON public.chapter_progress
FOR UPDATE TO authenticated
USING (user_id = (SELECT auth.uid()))
WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY "chapter_progress_delete_own" ON public.chapter_progress
FOR DELETE TO authenticated
USING (user_id = (SELECT auth.uid()));
CREATE POLICY "cohorts_select_all" ON public.cohorts
FOR SELECT TO authenticated
USING (true);
CREATE POLICY "cohorts_insert_teacher" ON public.cohorts
FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = (SELECT auth.uid()) AND p.role = ANY (ARRAY['teacher'::text, 'admin'::text])));
CREATE POLICY "cohorts_update_teacher" ON public.cohorts
FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = (SELECT auth.uid()) AND p.role = ANY (ARRAY['teacher'::text, 'admin'::text])));
CREATE POLICY "cohorts_delete_teacher" ON public.cohorts
FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = (SELECT auth.uid()) AND p.role = ANY (ARRAY['teacher'::text, 'admin'::text])));
CREATE POLICY "course_events_select" ON public.course_events
FOR SELECT TO authenticated
USING (created_by = (SELECT auth.uid()) OR EXISTS (SELECT 1 FROM public.enrollments e WHERE e.course_id::text = course_events.course_id::text AND e.user_id = (SELECT auth.uid())) OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = (SELECT auth.uid()) AND p.role = 'admin'::text));
CREATE POLICY "prereqs_select_all" ON public.course_prerequisites
FOR SELECT TO authenticated
USING ((SELECT auth.uid()) IS NOT NULL);
CREATE POLICY "prereqs_insert_teacher" ON public.course_prerequisites
FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = (SELECT auth.uid()) AND p.role = ANY (ARRAY['teacher'::text, 'admin'::text])));
CREATE POLICY "prereqs_delete_teacher" ON public.course_prerequisites
FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = (SELECT auth.uid()) AND p.role = ANY (ARRAY['teacher'::text, 'admin'::text])));
CREATE POLICY "reviews_select_all" ON public.course_reviews
FOR SELECT TO authenticated
USING ((SELECT auth.uid()) IS NOT NULL);
CREATE POLICY "reviews_insert_own" ON public.course_reviews
FOR INSERT TO authenticated
WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY "reviews_update_own" ON public.course_reviews
FOR UPDATE TO authenticated
USING (user_id = (SELECT auth.uid()));
CREATE POLICY "reviews_delete_own" ON public.course_reviews
FOR DELETE TO authenticated
USING (user_id = (SELECT auth.uid()));
CREATE POLICY "courses_select_published" ON public.courses
FOR SELECT TO authenticated
USING (status = 'published'::text OR created_by = (SELECT auth.uid()) OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = (SELECT auth.uid()) AND p.role = 'admin'::text));
CREATE POLICY "courses_insert_teacher" ON public.courses
FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = (SELECT auth.uid()) AND p.role = ANY (ARRAY['teacher'::text, 'admin'::text])));
CREATE POLICY "courses_update_teacher" ON public.courses
FOR UPDATE TO authenticated
USING (created_by = (SELECT auth.uid()) OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = (SELECT auth.uid()) AND p.role = 'admin'::text));
CREATE POLICY "courses_delete_teacher" ON public.courses
FOR DELETE TO authenticated
USING (created_by = (SELECT auth.uid()) OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = (SELECT auth.uid()) AND p.role = 'admin'::text));
CREATE POLICY "enrollments_select" ON public.enrollments
FOR SELECT TO authenticated
USING (user_id = (SELECT auth.uid()) OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = (SELECT auth.uid()) AND p.role = ANY (ARRAY['teacher'::text, 'admin'::text])));
CREATE POLICY "enrollments_insert_own" ON public.enrollments
FOR INSERT TO authenticated
WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY "enrollments_delete_own" ON public.enrollments
FOR DELETE TO authenticated
USING (user_id = (SELECT auth.uid()));
CREATE POLICY "modules_select_public" ON public.modules
FOR SELECT TO authenticated
USING (true);
CREATE POLICY "modules_insert_teacher" ON public.modules
FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = (SELECT auth.uid()) AND p.role = ANY (ARRAY['teacher'::text, 'admin'::text])));
CREATE POLICY "modules_update_teacher" ON public.modules
FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = (SELECT auth.uid()) AND p.role = ANY (ARRAY['teacher'::text, 'admin'::text])));
CREATE POLICY "modules_delete_teacher" ON public.modules
FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = (SELECT auth.uid()) AND p.role = ANY (ARRAY['teacher'::text, 'admin'::text])));
CREATE POLICY "notifications_select_own" ON public.notifications
FOR SELECT TO authenticated
USING (user_id = (SELECT auth.uid()));
CREATE POLICY "notifications_update_own" ON public.notifications
FOR UPDATE TO authenticated
USING (user_id = (SELECT auth.uid()))
WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY "profiles_select_authenticated" ON public.profiles
FOR SELECT TO authenticated
USING ((SELECT auth.uid()) IS NOT NULL);
CREATE POLICY "profiles_update_own_no_role" ON public.profiles
FOR UPDATE TO authenticated
USING ((SELECT auth.uid()) = id)
WITH CHECK ((SELECT auth.uid()) = id AND role = (SELECT p.role FROM public.profiles p WHERE p.id = (SELECT auth.uid())));
CREATE POLICY "quiz_answers_select_own" ON public.quiz_answers
FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.quiz_attempts qa WHERE qa.id = quiz_answers.attempt_id AND (qa.user_id = (SELECT auth.uid()) OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = (SELECT auth.uid()) AND p.role = ANY (ARRAY['teacher'::text, 'admin'::text])))));
CREATE POLICY "quiz_answers_insert_own" ON public.quiz_answers
FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.quiz_attempts qa WHERE qa.id = quiz_answers.attempt_id AND qa.user_id = (SELECT auth.uid())));
CREATE POLICY "quiz_attempts_select_own" ON public.quiz_attempts
FOR SELECT TO authenticated
USING (user_id = (SELECT auth.uid()) OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = (SELECT auth.uid()) AND p.role = ANY (ARRAY['teacher'::text, 'admin'::text])));
CREATE POLICY "quiz_attempts_insert_own" ON public.quiz_attempts
FOR INSERT TO authenticated
WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY "quiz_attempts_update_own" ON public.quiz_attempts
FOR UPDATE TO authenticated
USING (user_id = (SELECT auth.uid()));
CREATE POLICY "quiz_extra_attempts_select_own" ON public.quiz_extra_attempts
FOR SELECT TO authenticated
USING (user_id = (SELECT auth.uid()) OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = (SELECT auth.uid()) AND p.role = ANY (ARRAY['teacher'::text, 'admin'::text])));
CREATE POLICY "quiz_options_select_all" ON public.quiz_options
FOR SELECT TO authenticated
USING ((SELECT auth.uid()) IS NOT NULL);
CREATE POLICY "quiz_options_insert_teacher" ON public.quiz_options
FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = (SELECT auth.uid()) AND p.role = ANY (ARRAY['teacher'::text, 'admin'::text])));
CREATE POLICY "quiz_options_update_teacher" ON public.quiz_options
FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = (SELECT auth.uid()) AND p.role = ANY (ARRAY['teacher'::text, 'admin'::text])));
CREATE POLICY "quiz_options_delete_teacher" ON public.quiz_options
FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = (SELECT auth.uid()) AND p.role = ANY (ARRAY['teacher'::text, 'admin'::text])));
CREATE POLICY "quiz_questions_select_all" ON public.quiz_questions
FOR SELECT TO authenticated
USING ((SELECT auth.uid()) IS NOT NULL);
CREATE POLICY "quiz_questions_insert_teacher" ON public.quiz_questions
FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = (SELECT auth.uid()) AND p.role = ANY (ARRAY['teacher'::text, 'admin'::text])));
CREATE POLICY "quiz_questions_update_teacher" ON public.quiz_questions
FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = (SELECT auth.uid()) AND p.role = ANY (ARRAY['teacher'::text, 'admin'::text])));
CREATE POLICY "quiz_questions_delete_teacher" ON public.quiz_questions
FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = (SELECT auth.uid()) AND p.role = ANY (ARRAY['teacher'::text, 'admin'::text])));
CREATE POLICY "quizzes_select_all" ON public.quizzes
FOR SELECT TO authenticated
USING ((SELECT auth.uid()) IS NOT NULL);
CREATE POLICY "quizzes_insert_teacher" ON public.quizzes
FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = (SELECT auth.uid()) AND p.role = ANY (ARRAY['teacher'::text, 'admin'::text])));
CREATE POLICY "quizzes_update_teacher" ON public.quizzes
FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = (SELECT auth.uid()) AND p.role = ANY (ARRAY['teacher'::text, 'admin'::text])));
CREATE POLICY "quizzes_delete_teacher" ON public.quizzes
FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = (SELECT auth.uid()) AND p.role = ANY (ARRAY['teacher'::text, 'admin'::text])));
CREATE POLICY "student_grades_select" ON public.student_grades
FOR SELECT TO authenticated
USING (student_id = (SELECT auth.uid()) OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = (SELECT auth.uid()) AND p.role = ANY (ARRAY['teacher'::text, 'admin'::text])));
CREATE POLICY "student_grades_insert_teacher" ON public.student_grades
FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = (SELECT auth.uid()) AND p.role = ANY (ARRAY['teacher'::text, 'admin'::text])));
CREATE POLICY "student_grades_update_teacher" ON public.student_grades
FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = (SELECT auth.uid()) AND p.role = ANY (ARRAY['teacher'::text, 'admin'::text])));
CREATE POLICY "student_grades_delete_teacher" ON public.student_grades
FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = (SELECT auth.uid()) AND p.role = ANY (ARRAY['teacher'::text, 'admin'::text])));
