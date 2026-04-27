-- Supabase migration: add_content_translations
-- Version: 20260425010100
--
-- Foundation for AI-assisted RU/EN course content. Two pieces:
--
--   1. ``courses.source_locale`` — which language the *original* author writes
--      in. All sub-entities (modules, chapters, blocks, quizzes…) inherit this
--      value; a per-block override can be added later without a schema change.
--
--   2. ``content_translations`` — a single, schema-light table that stores
--      derived (machine-translated) variants for any text-bearing entity. The
--      original text always stays on the source row (e.g. ``chapter_blocks
--      .content``); this table only holds the *other* locales.
--
-- Design notes:
--   - ``entity_id`` is TEXT so we can mix UUID-keyed rows (chapter_blocks) with
--     string-keyed rows (courses) without a polymorphic FK headache.
--   - ``source_hash`` lets the translation pipeline detect stale rows after the
--     author edits the source: hash of source text != stored hash → mark stale
--     and re-translate.
--   - ``status`` ∈ ('ok', 'stale', 'failed') drives the UI badge ("translation
--     out of date") and the retry queue.
--   - ``origin`` ∈ ('mt', 'human') reserves room for human overrides without
--     losing the machine baseline.
--   - RLS: any authenticated user may READ (translations follow the
--     visibility of the underlying course); only service-role / teachers may
--     mutate. The translation pipeline runs server-side under service_role.

ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS source_locale VARCHAR(8) NOT NULL DEFAULT 'ru';

ALTER TABLE public.courses
  DROP CONSTRAINT IF EXISTS courses_source_locale_check;

ALTER TABLE public.courses
  ADD CONSTRAINT courses_source_locale_check
  CHECK (source_locale IN ('ru', 'en'));


CREATE TABLE IF NOT EXISTS public.content_translations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type VARCHAR(40) NOT NULL,
  entity_id TEXT NOT NULL,
  field VARCHAR(40) NOT NULL,
  locale VARCHAR(8) NOT NULL,
  text TEXT NOT NULL,
  source_hash VARCHAR(64) NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'ok',
  origin VARCHAR(16) NOT NULL DEFAULT 'mt',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT content_translations_entity_type_check
    CHECK (entity_type IN ('chapter_block', 'course', 'module', 'chapter', 'quiz', 'quiz_question', 'quiz_option', 'assignment')),
  CONSTRAINT content_translations_field_check
    CHECK (field IN ('content', 'title', 'description', 'question_text', 'option_text', 'instructions')),
  CONSTRAINT content_translations_locale_check
    CHECK (locale IN ('ru', 'en')),
  CONSTRAINT content_translations_status_check
    CHECK (status IN ('ok', 'stale', 'failed')),
  CONSTRAINT content_translations_origin_check
    CHECK (origin IN ('mt', 'human')),
  CONSTRAINT content_translations_unique
    UNIQUE (entity_type, entity_id, field, locale)
);

CREATE INDEX IF NOT EXISTS ix_content_translations_entity
  ON public.content_translations (entity_type, entity_id);

-- Partial index for the retry queue: cheap to scan when the pipeline wakes up.
CREATE INDEX IF NOT EXISTS ix_content_translations_pending
  ON public.content_translations (status)
  WHERE status <> 'ok';


ALTER TABLE public.content_translations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "content_translations_select_authenticated" ON public.content_translations;
CREATE POLICY "content_translations_select_authenticated" ON public.content_translations
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "content_translations_insert_teacher" ON public.content_translations;
CREATE POLICY "content_translations_insert_teacher" ON public.content_translations
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = (SELECT auth.uid())
      AND p.role = ANY (ARRAY['teacher'::text, 'admin'::text])
  ));

DROP POLICY IF EXISTS "content_translations_update_teacher" ON public.content_translations;
CREATE POLICY "content_translations_update_teacher" ON public.content_translations
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = (SELECT auth.uid())
      AND p.role = ANY (ARRAY['teacher'::text, 'admin'::text])
  ));

DROP POLICY IF EXISTS "content_translations_delete_teacher" ON public.content_translations;
CREATE POLICY "content_translations_delete_teacher" ON public.content_translations
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = (SELECT auth.uid())
      AND p.role = ANY (ARRAY['teacher'::text, 'admin'::text])
  ));
