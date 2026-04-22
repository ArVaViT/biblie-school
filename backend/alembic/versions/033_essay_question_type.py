"""Add ``essay`` question type + manual grading fields.

Background
----------
Teachers used to disguise long-form exam essays as ``short_answer`` with
``points=20``, which broke autograding, reports and the student UX
(same tiny textarea regardless of whether the task is "name the apostle"
or "write 600 words on the book of Acts").

This migration makes ``essay`` a first-class question type and adds the
two columns that open-ended grading actually needs:

* ``quiz_questions.min_words`` — optional UX hint for the student
  textarea (`"write at least N words"`).
* ``quiz_answers.grader_comment`` — teacher feedback recorded at the
  moment ``points_earned`` is set.

The existing CHECK constraint ``quiz_questions_question_type_check`` is
dropped and recreated with the wider allow-list; no data is touched.

Revision ID: 033_essay_question_type
Revises: 032_chapter_blocks_bucket_path
Create Date: 2026-04-22
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "033_essay_question_type"
down_revision: str | None = "032_chapter_blocks_bucket_path"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "quiz_questions",
        sa.Column("min_words", sa.Integer(), nullable=True),
    )
    op.add_column(
        "quiz_answers",
        sa.Column("grader_comment", sa.Text(), nullable=True),
    )

    op.execute("ALTER TABLE quiz_questions DROP CONSTRAINT IF EXISTS quiz_questions_question_type_check")
    op.execute(
        """
        ALTER TABLE quiz_questions
        ADD CONSTRAINT quiz_questions_question_type_check
        CHECK (question_type IN ('multiple_choice', 'true_false', 'short_answer', 'essay'))
        """
    )


def downgrade() -> None:
    # Collapse any ``essay`` questions back into ``short_answer`` so the
    # narrower CHECK can be re-applied without losing rows.
    op.execute("UPDATE quiz_questions SET question_type = 'short_answer' WHERE question_type = 'essay'")
    op.execute("ALTER TABLE quiz_questions DROP CONSTRAINT IF EXISTS quiz_questions_question_type_check")
    op.execute(
        """
        ALTER TABLE quiz_questions
        ADD CONSTRAINT quiz_questions_question_type_check
        CHECK (question_type IN ('multiple_choice', 'true_false', 'short_answer'))
        """
    )
    op.drop_column("quiz_answers", "grader_comment")
    op.drop_column("quiz_questions", "min_words")
