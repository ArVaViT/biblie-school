-- Supabase migration: essay_question_type
-- Version: 20260422224420

ALTER TABLE quiz_questions ADD COLUMN min_words INTEGER;
ALTER TABLE quiz_answers ADD COLUMN grader_comment TEXT;

ALTER TABLE quiz_questions DROP CONSTRAINT IF EXISTS quiz_questions_question_type_check;
ALTER TABLE quiz_questions
  ADD CONSTRAINT quiz_questions_question_type_check
  CHECK (question_type IN ('multiple_choice', 'true_false', 'short_answer', 'essay'));
