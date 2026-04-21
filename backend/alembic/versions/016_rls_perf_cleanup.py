"""RLS performance cleanup — init-plan wrappers, consolidate policies, dedupe indexes.

Revision ID: 016_rls_perf_cleanup
Revises: 015_add_quiz_user_fks
Create Date: 2026-04-20

Supabase's ``auth_rls_initplan`` linter flags policies that call ``auth.uid()``
or ``auth.role()`` directly in their ``USING``/``WITH CHECK`` expressions:
those functions get re-evaluated once per row, which explodes cost on any
large table. The recommended fix is to wrap each auth call in a scalar
subquery — ``(SELECT auth.uid())`` — so Postgres hoists it into a single
init-plan evaluation per query.

While we're touching every policy on every public table, we also:

1. Scope each policy to the ``authenticated`` role (was ``public``, which
   forced the check to run for anonymous users too).
2. Consolidate ``chapter_progress``'s duplicated student/teacher SELECT
   policies so the ``multiple_permissive_policies`` warning clears.
3. Drop the handful of ``idx_*`` indexes that are identical to the SQLAlchemy
   ``ix_*`` duplicates — cuts write amplification on hot tables.
4. Add covering indexes for the foreign keys the perf advisor flagged as
   unindexed, removing the ``unindexed_foreign_keys`` INFO notices.

Backend code connects as ``service_role`` (BYPASSRLS=true), so these policy
rewrites only affect the Supabase JS client and REST surface. The on-disk
schema does not change, only grants and index topology.
"""

from collections.abc import Sequence

from alembic import op

revision: str = "016_rls_perf_cleanup"
down_revision: str | None = "015_add_quiz_user_fks"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _is_postgres() -> bool:
    bind = op.get_bind()
    return bind.dialect.name == "postgresql"


# ---------------------------------------------------------------------------
# Policy rewrites. Each entry is (table, policyname, cmd, using_sql,
# with_check_sql). ``authenticated`` is the target role for every rewritten
# policy. Anything left as `None` is omitted from the CREATE statement.
# ---------------------------------------------------------------------------

AUID = "(SELECT auth.uid())"
AROLE = "(SELECT auth.role())"

POLICIES: list[tuple[str, str, str, str | None, str | None]] = [
    # announcements -----------------------------------------------------------
    (
        "announcements",
        "announcements_select_authenticated",
        "SELECT",
        f"{AUID} IS NOT NULL",
        None,
    ),
    (
        "announcements",
        "announcements_insert_teacher",
        "INSERT",
        None,
        f"EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = {AUID} "
        "AND p.role = ANY (ARRAY['teacher'::text, 'admin'::text]))",
    ),
    (
        "announcements",
        "announcements_update_own",
        "UPDATE",
        f"created_by = {AUID} OR EXISTS (SELECT 1 FROM public.profiles p "
        f"WHERE p.id = {AUID} AND p.role = 'admin'::text)",
        None,
    ),
    (
        "announcements",
        "announcements_delete_own",
        "DELETE",
        f"created_by = {AUID} OR EXISTS (SELECT 1 FROM public.profiles p "
        f"WHERE p.id = {AUID} AND p.role = 'admin'::text)",
        None,
    ),
    # assignment_submissions --------------------------------------------------
    (
        "assignment_submissions",
        "submissions_select_own_or_teacher",
        "SELECT",
        f"student_id = {AUID} OR EXISTS (SELECT 1 FROM public.profiles p "
        f"WHERE p.id = {AUID} AND p.role = ANY (ARRAY['teacher'::text, 'admin'::text]))",
        None,
    ),
    (
        "assignment_submissions",
        "submissions_insert_own",
        "INSERT",
        None,
        f"student_id = {AUID}",
    ),
    (
        "assignment_submissions",
        "submissions_update_teacher",
        "UPDATE",
        f"student_id = {AUID} OR EXISTS (SELECT 1 FROM public.profiles p "
        f"WHERE p.id = {AUID} AND p.role = ANY (ARRAY['teacher'::text, 'admin'::text]))",
        None,
    ),
    # assignments -------------------------------------------------------------
    (
        "assignments",
        "assignments_select_all",
        "SELECT",
        f"{AUID} IS NOT NULL",
        None,
    ),
    (
        "assignments",
        "assignments_insert_teacher",
        "INSERT",
        None,
        f"EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = {AUID} "
        "AND p.role = ANY (ARRAY['teacher'::text, 'admin'::text]))",
    ),
    (
        "assignments",
        "assignments_update_teacher",
        "UPDATE",
        f"EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = {AUID} "
        "AND p.role = ANY (ARRAY['teacher'::text, 'admin'::text]))",
        None,
    ),
    (
        "assignments",
        "assignments_delete_teacher",
        "DELETE",
        f"EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = {AUID} "
        "AND p.role = ANY (ARRAY['teacher'::text, 'admin'::text]))",
        None,
    ),
    # audit_logs (already scoped to authenticated; just wrap auth.uid) --------
    (
        "audit_logs",
        "audit_logs_select_admin",
        "SELECT",
        f"EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = {AUID} AND p.role = 'admin'::text)",
        None,
    ),
    # certificates ------------------------------------------------------------
    (
        "certificates",
        "certificates_select_own_or_teacher",
        "SELECT",
        f"user_id = {AUID} OR EXISTS (SELECT 1 FROM public.profiles p "
        f"WHERE p.id = {AUID} AND p.role = ANY (ARRAY['teacher'::text, 'admin'::text]))",
        None,
    ),
    (
        "certificates",
        "certificates_insert_request",
        "INSERT",
        None,
        f"user_id = {AUID}",
    ),
    (
        "certificates",
        "certificates_update_approval",
        "UPDATE",
        f"user_id = {AUID} OR EXISTS (SELECT 1 FROM public.profiles p "
        f"WHERE p.id = {AUID} AND p.role = ANY (ARRAY['teacher'::text, 'admin'::text]))",
        None,
    ),
    # chapter_blocks ----------------------------------------------------------
    (
        "chapter_blocks",
        "blocks_select_all",
        "SELECT",
        f"{AUID} IS NOT NULL",
        None,
    ),
    (
        "chapter_blocks",
        "blocks_insert_teacher",
        "INSERT",
        None,
        f"EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = {AUID} "
        "AND p.role = ANY (ARRAY['teacher'::text, 'admin'::text]))",
    ),
    (
        "chapter_blocks",
        "blocks_update_teacher",
        "UPDATE",
        f"EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = {AUID} "
        "AND p.role = ANY (ARRAY['teacher'::text, 'admin'::text]))",
        None,
    ),
    (
        "chapter_blocks",
        "blocks_delete_teacher",
        "DELETE",
        f"EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = {AUID} "
        "AND p.role = ANY (ARRAY['teacher'::text, 'admin'::text]))",
        None,
    ),
    # chapters ----------------------------------------------------------------
    (
        "chapters",
        "chapters_select_public",
        "SELECT",
        "true",
        None,
    ),
    (
        "chapters",
        "chapters_insert_teacher",
        "INSERT",
        None,
        f"EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = {AUID} "
        "AND p.role = ANY (ARRAY['teacher'::text, 'admin'::text]))",
    ),
    (
        "chapters",
        "chapters_update_teacher",
        "UPDATE",
        f"EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = {AUID} "
        "AND p.role = ANY (ARRAY['teacher'::text, 'admin'::text]))",
        None,
    ),
    (
        "chapters",
        "chapters_delete_teacher",
        "DELETE",
        f"EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = {AUID} "
        "AND p.role = ANY (ARRAY['teacher'::text, 'admin'::text]))",
        None,
    ),
    # chapter_progress (consolidated: one student policy + one staff policy) --
    (
        "chapter_progress",
        "chapter_progress_select",
        "SELECT",
        f"user_id = {AUID} OR EXISTS (SELECT 1 FROM public.profiles p "
        f"WHERE p.id = {AUID} AND p.role = ANY (ARRAY['teacher'::text, 'admin'::text]))",
        None,
    ),
    (
        "chapter_progress",
        "chapter_progress_insert_own",
        "INSERT",
        None,
        f"user_id = {AUID}",
    ),
    (
        "chapter_progress",
        "chapter_progress_update_own",
        "UPDATE",
        f"user_id = {AUID}",
        f"user_id = {AUID}",
    ),
    (
        "chapter_progress",
        "chapter_progress_delete_own",
        "DELETE",
        f"user_id = {AUID}",
        None,
    ),
    # cohorts -----------------------------------------------------------------
    ("cohorts", "cohorts_select_all", "SELECT", "true", None),
    (
        "cohorts",
        "cohorts_insert_teacher",
        "INSERT",
        None,
        f"EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = {AUID} "
        "AND p.role = ANY (ARRAY['teacher'::text, 'admin'::text]))",
    ),
    (
        "cohorts",
        "cohorts_update_teacher",
        "UPDATE",
        f"EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = {AUID} "
        "AND p.role = ANY (ARRAY['teacher'::text, 'admin'::text]))",
        None,
    ),
    (
        "cohorts",
        "cohorts_delete_teacher",
        "DELETE",
        f"EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = {AUID} "
        "AND p.role = ANY (ARRAY['teacher'::text, 'admin'::text]))",
        None,
    ),
    # course_events (already scoped to authenticated) ------------------------
    (
        "course_events",
        "course_events_select",
        "SELECT",
        f"created_by = {AUID} OR EXISTS (SELECT 1 FROM public.enrollments e "
        f"WHERE e.course_id::text = course_events.course_id::text AND e.user_id = {AUID}) "
        f"OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = {AUID} AND p.role = 'admin'::text)",
        None,
    ),
    # course_prerequisites ----------------------------------------------------
    (
        "course_prerequisites",
        "prereqs_select_all",
        "SELECT",
        f"{AUID} IS NOT NULL",
        None,
    ),
    (
        "course_prerequisites",
        "prereqs_insert_teacher",
        "INSERT",
        None,
        f"EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = {AUID} "
        "AND p.role = ANY (ARRAY['teacher'::text, 'admin'::text]))",
    ),
    (
        "course_prerequisites",
        "prereqs_delete_teacher",
        "DELETE",
        f"EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = {AUID} "
        "AND p.role = ANY (ARRAY['teacher'::text, 'admin'::text]))",
        None,
    ),
    # course_reviews ----------------------------------------------------------
    (
        "course_reviews",
        "reviews_select_all",
        "SELECT",
        f"{AUID} IS NOT NULL",
        None,
    ),
    (
        "course_reviews",
        "reviews_insert_own",
        "INSERT",
        None,
        f"user_id = {AUID}",
    ),
    (
        "course_reviews",
        "reviews_update_own",
        "UPDATE",
        f"user_id = {AUID}",
        None,
    ),
    (
        "course_reviews",
        "reviews_delete_own",
        "DELETE",
        f"user_id = {AUID}",
        None,
    ),
    # courses -----------------------------------------------------------------
    (
        "courses",
        "courses_select_published",
        "SELECT",
        f"status = 'published'::text OR created_by = {AUID} "
        f"OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = {AUID} AND p.role = 'admin'::text)",
        None,
    ),
    (
        "courses",
        "courses_insert_teacher",
        "INSERT",
        None,
        f"EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = {AUID} "
        "AND p.role = ANY (ARRAY['teacher'::text, 'admin'::text]))",
    ),
    (
        "courses",
        "courses_update_teacher",
        "UPDATE",
        f"created_by = {AUID} OR EXISTS (SELECT 1 FROM public.profiles p "
        f"WHERE p.id = {AUID} AND p.role = 'admin'::text)",
        None,
    ),
    (
        "courses",
        "courses_delete_teacher",
        "DELETE",
        f"created_by = {AUID} OR EXISTS (SELECT 1 FROM public.profiles p "
        f"WHERE p.id = {AUID} AND p.role = 'admin'::text)",
        None,
    ),
    # enrollments (consolidated SELECT) ---------------------------------------
    (
        "enrollments",
        "enrollments_select",
        "SELECT",
        f"user_id = {AUID} OR EXISTS (SELECT 1 FROM public.profiles p "
        f"WHERE p.id = {AUID} AND p.role = ANY (ARRAY['teacher'::text, 'admin'::text]))",
        None,
    ),
    (
        "enrollments",
        "enrollments_insert_own",
        "INSERT",
        None,
        f"user_id = {AUID}",
    ),
    (
        "enrollments",
        "enrollments_delete_own",
        "DELETE",
        f"user_id = {AUID}",
        None,
    ),
    # modules -----------------------------------------------------------------
    ("modules", "modules_select_public", "SELECT", "true", None),
    (
        "modules",
        "modules_insert_teacher",
        "INSERT",
        None,
        f"EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = {AUID} "
        "AND p.role = ANY (ARRAY['teacher'::text, 'admin'::text]))",
    ),
    (
        "modules",
        "modules_update_teacher",
        "UPDATE",
        f"EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = {AUID} "
        "AND p.role = ANY (ARRAY['teacher'::text, 'admin'::text]))",
        None,
    ),
    (
        "modules",
        "modules_delete_teacher",
        "DELETE",
        f"EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = {AUID} "
        "AND p.role = ANY (ARRAY['teacher'::text, 'admin'::text]))",
        None,
    ),
    # notifications (already scoped to authenticated) -------------------------
    (
        "notifications",
        "notifications_select_own",
        "SELECT",
        f"user_id = {AUID}",
        None,
    ),
    (
        "notifications",
        "notifications_update_own",
        "UPDATE",
        f"user_id = {AUID}",
        f"user_id = {AUID}",
    ),
    # profiles ----------------------------------------------------------------
    (
        "profiles",
        "profiles_select_authenticated",
        "SELECT",
        f"{AUID} IS NOT NULL",
        None,
    ),
    (
        "profiles",
        "profiles_update_own_no_role",
        "UPDATE",
        f"{AUID} = id",
        f"{AUID} = id AND role = (SELECT p.role FROM public.profiles p WHERE p.id = {AUID})",
    ),
    # quiz_answers ------------------------------------------------------------
    (
        "quiz_answers",
        "quiz_answers_select_own",
        "SELECT",
        f"EXISTS (SELECT 1 FROM public.quiz_attempts qa "
        f"WHERE qa.id = quiz_answers.attempt_id "
        f"AND (qa.user_id = {AUID} OR EXISTS (SELECT 1 FROM public.profiles p "
        f"WHERE p.id = {AUID} AND p.role = ANY (ARRAY['teacher'::text, 'admin'::text]))))",
        None,
    ),
    (
        "quiz_answers",
        "quiz_answers_insert_own",
        "INSERT",
        None,
        f"EXISTS (SELECT 1 FROM public.quiz_attempts qa WHERE qa.id = quiz_answers.attempt_id AND qa.user_id = {AUID})",
    ),
    # quiz_attempts -----------------------------------------------------------
    (
        "quiz_attempts",
        "quiz_attempts_select_own",
        "SELECT",
        f"user_id = {AUID} OR EXISTS (SELECT 1 FROM public.profiles p "
        f"WHERE p.id = {AUID} AND p.role = ANY (ARRAY['teacher'::text, 'admin'::text]))",
        None,
    ),
    (
        "quiz_attempts",
        "quiz_attempts_insert_own",
        "INSERT",
        None,
        f"user_id = {AUID}",
    ),
    (
        "quiz_attempts",
        "quiz_attempts_update_own",
        "UPDATE",
        f"user_id = {AUID}",
        None,
    ),
    # quiz_extra_attempts (already scoped to authenticated) -------------------
    (
        "quiz_extra_attempts",
        "quiz_extra_attempts_select_own",
        "SELECT",
        f"user_id = {AUID} OR EXISTS (SELECT 1 FROM public.profiles p "
        f"WHERE p.id = {AUID} AND p.role = ANY (ARRAY['teacher'::text, 'admin'::text]))",
        None,
    ),
    # quiz_options ------------------------------------------------------------
    (
        "quiz_options",
        "quiz_options_select_all",
        "SELECT",
        f"{AUID} IS NOT NULL",
        None,
    ),
    (
        "quiz_options",
        "quiz_options_insert_teacher",
        "INSERT",
        None,
        f"EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = {AUID} "
        "AND p.role = ANY (ARRAY['teacher'::text, 'admin'::text]))",
    ),
    (
        "quiz_options",
        "quiz_options_update_teacher",
        "UPDATE",
        f"EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = {AUID} "
        "AND p.role = ANY (ARRAY['teacher'::text, 'admin'::text]))",
        None,
    ),
    (
        "quiz_options",
        "quiz_options_delete_teacher",
        "DELETE",
        f"EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = {AUID} "
        "AND p.role = ANY (ARRAY['teacher'::text, 'admin'::text]))",
        None,
    ),
    # quiz_questions ----------------------------------------------------------
    (
        "quiz_questions",
        "quiz_questions_select_all",
        "SELECT",
        f"{AUID} IS NOT NULL",
        None,
    ),
    (
        "quiz_questions",
        "quiz_questions_insert_teacher",
        "INSERT",
        None,
        f"EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = {AUID} "
        "AND p.role = ANY (ARRAY['teacher'::text, 'admin'::text]))",
    ),
    (
        "quiz_questions",
        "quiz_questions_update_teacher",
        "UPDATE",
        f"EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = {AUID} "
        "AND p.role = ANY (ARRAY['teacher'::text, 'admin'::text]))",
        None,
    ),
    (
        "quiz_questions",
        "quiz_questions_delete_teacher",
        "DELETE",
        f"EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = {AUID} "
        "AND p.role = ANY (ARRAY['teacher'::text, 'admin'::text]))",
        None,
    ),
    # quizzes -----------------------------------------------------------------
    ("quizzes", "quizzes_select_all", "SELECT", f"{AUID} IS NOT NULL", None),
    (
        "quizzes",
        "quizzes_insert_teacher",
        "INSERT",
        None,
        f"EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = {AUID} "
        "AND p.role = ANY (ARRAY['teacher'::text, 'admin'::text]))",
    ),
    (
        "quizzes",
        "quizzes_update_teacher",
        "UPDATE",
        f"EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = {AUID} "
        "AND p.role = ANY (ARRAY['teacher'::text, 'admin'::text]))",
        None,
    ),
    (
        "quizzes",
        "quizzes_delete_teacher",
        "DELETE",
        f"EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = {AUID} "
        "AND p.role = ANY (ARRAY['teacher'::text, 'admin'::text]))",
        None,
    ),
    # student_grades (consolidated SELECT) ------------------------------------
    (
        "student_grades",
        "student_grades_select",
        "SELECT",
        f"student_id = {AUID} OR EXISTS (SELECT 1 FROM public.profiles p "
        f"WHERE p.id = {AUID} AND p.role = ANY (ARRAY['teacher'::text, 'admin'::text]))",
        None,
    ),
    (
        "student_grades",
        "student_grades_insert_teacher",
        "INSERT",
        None,
        f"EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = {AUID} "
        "AND p.role = ANY (ARRAY['teacher'::text, 'admin'::text]))",
    ),
    (
        "student_grades",
        "student_grades_update_teacher",
        "UPDATE",
        f"EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = {AUID} "
        "AND p.role = ANY (ARRAY['teacher'::text, 'admin'::text]))",
        None,
    ),
    (
        "student_grades",
        "student_grades_delete_teacher",
        "DELETE",
        f"EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = {AUID} "
        "AND p.role = ANY (ARRAY['teacher'::text, 'admin'::text]))",
        None,
    ),
]

# Policies that existed before this migration but are being replaced or
# consolidated away and must be dropped by name.
LEGACY_POLICY_NAMES: dict[str, list[str]] = {
    "announcements": [
        "announcements_select_authenticated",
        "announcements_insert_teacher",
        "announcements_update_own",
        "announcements_delete_own",
    ],
    "assignment_submissions": [
        "submissions_select_own_or_teacher",
        "submissions_insert_own",
        "submissions_update_teacher",
    ],
    "assignments": [
        "assignments_select_all",
        "assignments_insert_teacher",
        "assignments_update_teacher",
        "assignments_delete_teacher",
    ],
    "audit_logs": ["audit_logs_select_admin"],
    "certificates": [
        "certificates_select_own_or_teacher",
        "certificates_insert_request",
        "certificates_update_approval",
    ],
    "chapter_blocks": [
        "blocks_select_all",
        "blocks_insert_teacher",
        "blocks_update_teacher",
        "blocks_delete_teacher",
    ],
    "chapters": [
        "chapters_select_public",
        "chapters_insert_teacher",
        "chapters_update_teacher",
        "chapters_delete_teacher",
    ],
    "chapter_progress": [
        # new canonical names
        "chapter_progress_select",
        "chapter_progress_insert_own",
        "chapter_progress_update_own",
        "chapter_progress_delete_own",
        # legacy / duplicate policies we are consolidating away
        "chapter_progress_select_own",
        "chapter_progress_select_teacher",
        "users_read_own_progress",
        "users_insert_own_progress",
        "users_delete_own_progress",
        "teachers_read_all_progress",
    ],
    "cohorts": [
        "cohorts_select_all",
        "cohorts_insert_teacher",
        "cohorts_update_teacher",
        "cohorts_delete_teacher",
    ],
    "course_events": ["course_events_select"],
    "course_prerequisites": [
        "prereqs_select_all",
        "prereqs_insert_teacher",
        "prereqs_delete_teacher",
    ],
    "course_reviews": [
        "reviews_select_all",
        "reviews_insert_own",
        "reviews_update_own",
        "reviews_delete_own",
    ],
    "courses": [
        "courses_select_published",
        "courses_insert_teacher",
        "courses_update_teacher",
        "courses_delete_teacher",
    ],
    "enrollments": [
        "enrollments_select",
        "enrollments_select_own",
        "enrollments_select_teacher",
        "enrollments_insert_own",
        "enrollments_delete_own",
    ],
    "modules": [
        "modules_select_public",
        "modules_insert_teacher",
        "modules_update_teacher",
        "modules_delete_teacher",
    ],
    "notifications": [
        "notifications_select_own",
        "notifications_update_own",
    ],
    "profiles": [
        "Users can view own profile",
        "profiles_select_authenticated",
        "profiles_update_own_no_role",
    ],
    "quiz_answers": [
        "quiz_answers_select_own",
        "quiz_answers_insert_own",
    ],
    "quiz_attempts": [
        "quiz_attempts_select_own",
        "quiz_attempts_insert_own",
        "quiz_attempts_update_own",
    ],
    "quiz_extra_attempts": ["quiz_extra_attempts_select_own"],
    "quiz_options": [
        "quiz_options_select_all",
        "quiz_options_insert_teacher",
        "quiz_options_update_teacher",
        "quiz_options_delete_teacher",
    ],
    "quiz_questions": [
        "quiz_questions_select_all",
        "quiz_questions_insert_teacher",
        "quiz_questions_update_teacher",
        "quiz_questions_delete_teacher",
    ],
    "quizzes": [
        "quizzes_select_all",
        "quizzes_insert_teacher",
        "quizzes_update_teacher",
        "quizzes_delete_teacher",
    ],
    "student_grades": [
        "student_grades_select",
        "student_grades_insert_teacher",
        "student_grades_update_teacher",
        "student_grades_delete_teacher",
        "students_read_own_grades",
        "teachers_read_all_grades",
        "teachers_insert_grades",
        "teachers_update_grades",
        "teachers_delete_grades",
    ],
}

# Duplicate idx_* indexes that mirror SQLAlchemy-generated ix_* indexes. We
# keep the ix_* copies (they're created automatically on model changes) and
# drop the manually-added duplicates.
DUPLICATE_IDX_NAMES = [
    "idx_announcements_course_id",
    "idx_assignments_chapter_id",
    "idx_chapter_blocks_chapter_id",
    "idx_chapter_progress_chapter_id",
    "idx_chapter_progress_user_id",
    "idx_chapters_module_id",
    "idx_reviews_course_id",
    "idx_courses_created_by",
    "idx_courses_status",
    "idx_enrollments_course_id",
    "idx_enrollments_user_id",
    "idx_modules_course_id",
    "idx_quiz_attempts_quiz_id",
    "idx_quizzes_chapter_id",
]

# Foreign keys the advisor flagged as unindexed. Each tuple is (index_name,
# table, column). INDEX IF NOT EXISTS so re-running on an already-patched DB
# is a no-op.
MISSING_FK_INDEXES: list[tuple[str, str, str]] = [
    ("ix_announcements_created_by", "announcements", "created_by"),
    ("ix_assignment_submissions_graded_by", "assignment_submissions", "graded_by"),
    ("ix_certificates_admin_approved_by", "certificates", "admin_approved_by"),
    ("ix_certificates_cohort_id", "certificates", "cohort_id"),
    ("ix_certificates_course_id", "certificates", "course_id"),
    ("ix_certificates_teacher_approved_by", "certificates", "teacher_approved_by"),
    ("ix_chapter_blocks_assignment_id", "chapter_blocks", "assignment_id"),
    ("ix_chapter_blocks_quiz_id", "chapter_blocks", "quiz_id"),
    ("ix_chapter_progress_completed_by", "chapter_progress", "completed_by"),
    ("ix_course_prerequisites_prerequisite_course_id", "course_prerequisites", "prerequisite_course_id"),
    ("ix_quiz_answers_question_id", "quiz_answers", "question_id"),
    ("ix_quiz_answers_selected_option_id", "quiz_answers", "selected_option_id"),
    ("ix_quiz_extra_attempts_user_id", "quiz_extra_attempts", "user_id"),
    ("ix_student_grades_cohort_id", "student_grades", "cohort_id"),
    ("ix_student_grades_graded_by", "student_grades", "graded_by"),
]


def upgrade() -> None:
    if not _is_postgres():
        return

    # 1. Drop every policy we touch, in every table, so recreates are idempotent.
    for table, names in LEGACY_POLICY_NAMES.items():
        for name in names:
            op.execute(f'DROP POLICY IF EXISTS "{name}" ON public.{table}')

    # 2. Recreate policies with init-plan-safe (SELECT auth.uid()) and scoped to
    #    the authenticated role.
    for table, name, cmd, using_sql, with_check_sql in POLICIES:
        parts = [f'CREATE POLICY "{name}" ON public.{table}']
        parts.append(f"FOR {cmd} TO authenticated")
        if using_sql is not None:
            parts.append(f"USING ({using_sql})")
        if with_check_sql is not None:
            parts.append(f"WITH CHECK ({with_check_sql})")
        op.execute("\n".join(parts))

    # 3. Drop duplicate indexes (keep the ix_* variant).
    for idx in DUPLICATE_IDX_NAMES:
        op.execute(f"DROP INDEX IF EXISTS public.{idx}")

    # 4. Add indexes for flagged unindexed foreign keys.
    for idx, table, column in MISSING_FK_INDEXES:
        op.execute(f"CREATE INDEX IF NOT EXISTS {idx} ON public.{table} ({column})")

    # 5. Rescope the legacy "Service role full access" policy on profiles to the
    #    service_role grantee only. Previously it was ``TO public`` which caused
    #    the advisor to count it as a second permissive policy for authenticated
    #    users (even though auth.role() = 'service_role' is always false there).
    op.execute('DROP POLICY IF EXISTS "Service role full access" ON public.profiles')
    op.execute(
        'CREATE POLICY "profiles_service_role_full" ON public.profiles '
        "AS PERMISSIVE FOR ALL TO service_role "
        "USING (true) WITH CHECK (true)"
    )


def downgrade() -> None:
    if not _is_postgres():
        return

    # Undo the service_role rescope. The original "Service role full access"
    # policy was TO public with `auth.role() = 'service_role'`, which we can
    # reconstruct verbatim.
    op.execute('DROP POLICY IF EXISTS "profiles_service_role_full" ON public.profiles')
    op.execute(
        'CREATE POLICY "Service role full access" ON public.profiles '
        "AS PERMISSIVE FOR ALL TO public "
        "USING (auth.role() = 'service_role'::text)"
    )

    # Drop the FK indexes we added (keeps downgrade reversible).
    for idx, _table, _column in MISSING_FK_INDEXES:
        op.execute(f"DROP INDEX IF EXISTS public.{idx}")

    # Drop the policies we created (best-effort; original policies can only be
    # restored from the upstream Supabase migrations, which aren't versioned
    # in this repo).
    for table, _name, _cmd, _using_sql, _with_check_sql in POLICIES:
        op.execute(f'DROP POLICY IF EXISTS "{_name}" ON public.{table}')
