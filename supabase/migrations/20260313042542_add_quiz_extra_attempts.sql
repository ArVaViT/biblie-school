-- Supabase migration: add_quiz_extra_attempts
-- Version: 20260313042542

CREATE TABLE IF NOT EXISTS quiz_extra_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  extra_attempts INTEGER NOT NULL DEFAULT 1,
  granted_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ix_quiz_extra_attempts_quiz_user ON quiz_extra_attempts(quiz_id, user_id);

ALTER TABLE quiz_extra_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "quiz_extra_attempts_all" ON quiz_extra_attempts FOR ALL USING (true) WITH CHECK (true);
