-- Supabase migration: fix_rls_security_gaps
-- Version: 20260421010600

-- Phase 0 security fixes: enable RLS on 3 exposed tables + fix permissive quiz policy

-- 0.1 notifications: enable RLS, restrict to own user
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY notifications_select_own ON public.notifications
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY notifications_update_own ON public.notifications
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 0.1 course_events: enable RLS, allow enrolled + owner + admin SELECT
ALTER TABLE public.course_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY course_events_select ON public.course_events
  FOR SELECT TO authenticated
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.enrollments e
      WHERE e.course_id = course_events.course_id
        AND e.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- 0.1 audit_logs: enable RLS, admin-only SELECT
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY audit_logs_select_admin ON public.audit_logs
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- 0.2 quiz_extra_attempts: drop permissive policy, restrict SELECT to own + teacher/admin
DROP POLICY IF EXISTS quiz_extra_attempts_all ON public.quiz_extra_attempts;

CREATE POLICY quiz_extra_attempts_select_own ON public.quiz_extra_attempts
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('teacher','admin')
    )
  );
