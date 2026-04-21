"""Enable RLS on notifications, course_events, audit_logs and fix quiz_extra_attempts policy.

Revision ID: 013_enable_rls_security_fixes
Revises: 012_allow_exam_chapter_type
Create Date: 2026-04-20

Phase 0 security fixes:
  - notifications, course_events, audit_logs were exposed via PostgREST with RLS disabled
  - quiz_extra_attempts had an overly permissive `USING (true) WITH CHECK (true)` policy

Backend connects as the `postgres` or `service_role` user (BYPASSRLS=true), so
these policies only affect direct access from Supabase JS client using the
`anon` or `authenticated` role.
"""

from collections.abc import Sequence

from alembic import op

revision: str = "013_enable_rls_security_fixes"
down_revision: str | None = "012_allow_exam_chapter_type"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _is_postgres() -> bool:
    bind = op.get_bind()
    return bind.dialect.name == "postgresql"


def upgrade() -> None:
    if not _is_postgres():
        return

    op.execute("ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY")
    op.execute(
        """
        CREATE POLICY notifications_select_own ON public.notifications
          FOR SELECT TO authenticated
          USING (user_id = auth.uid())
        """
    )
    op.execute(
        """
        CREATE POLICY notifications_update_own ON public.notifications
          FOR UPDATE TO authenticated
          USING (user_id = auth.uid())
          WITH CHECK (user_id = auth.uid())
        """
    )

    op.execute("ALTER TABLE public.course_events ENABLE ROW LEVEL SECURITY")
    op.execute(
        """
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
          )
        """
    )

    op.execute("ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY")
    op.execute(
        """
        CREATE POLICY audit_logs_select_admin ON public.audit_logs
          FOR SELECT TO authenticated
          USING (
            EXISTS (
              SELECT 1 FROM public.profiles p
              WHERE p.id = auth.uid() AND p.role = 'admin'
            )
          )
        """
    )

    op.execute("DROP POLICY IF EXISTS quiz_extra_attempts_all ON public.quiz_extra_attempts")
    op.execute(
        """
        CREATE POLICY quiz_extra_attempts_select_own ON public.quiz_extra_attempts
          FOR SELECT TO authenticated
          USING (
            user_id = auth.uid()
            OR EXISTS (
              SELECT 1 FROM public.profiles p
              WHERE p.id = auth.uid() AND p.role IN ('teacher', 'admin')
            )
          )
        """
    )


def downgrade() -> None:
    if not _is_postgres():
        return

    op.execute("DROP POLICY IF EXISTS quiz_extra_attempts_select_own ON public.quiz_extra_attempts")
    op.execute(
        """
        CREATE POLICY quiz_extra_attempts_all ON public.quiz_extra_attempts
          FOR ALL TO public
          USING (true) WITH CHECK (true)
        """
    )

    op.execute("DROP POLICY IF EXISTS audit_logs_select_admin ON public.audit_logs")
    op.execute("ALTER TABLE public.audit_logs DISABLE ROW LEVEL SECURITY")

    op.execute("DROP POLICY IF EXISTS course_events_select ON public.course_events")
    op.execute("ALTER TABLE public.course_events DISABLE ROW LEVEL SECURITY")

    op.execute("DROP POLICY IF EXISTS notifications_update_own ON public.notifications")
    op.execute("DROP POLICY IF EXISTS notifications_select_own ON public.notifications")
    op.execute("ALTER TABLE public.notifications DISABLE ROW LEVEL SECURITY")
