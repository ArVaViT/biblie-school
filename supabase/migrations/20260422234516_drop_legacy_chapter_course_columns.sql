-- Supabase migration: drop_legacy_chapter_course_columns
-- Version: 20260422234516
--
-- Cleans up schema drift between the SQLAlchemy models and production.
-- Before this migration:
--   * chapter_blocks.video_url — 2 rows with YouTube URLs from the old
--     "video" block type (collapsed into rich-text embeds in migration 025).
--   * chapters.content — 1 row of legacy pre-blocks HTML.
--   * chapters.video_url — 0 rows, superseded by chapter blocks.
--   * courses.start_date / courses.end_date — 0 rows, superseded by cohorts.
--   * chapter_blocks CHECK still permitted 'video'; schemas Literal does not.
-- After this migration the information_schema.columns dump matches the
-- SQLAlchemy models column-for-column.

-- 1. Preserve the two legacy video_url rows by converting them to text
--    blocks that embed the same YouTube clip via the RichTextEditor's
--    `data-youtube-embed` markup. This keeps the video visible to anyone
--    viewing the chapter and avoids an information loss.
UPDATE chapter_blocks
   SET block_type = 'text',
       content = '<div data-youtube-embed="" class="youtube-embed-wrapper"><iframe src="https://www.youtube.com/embed/'
                  || substring(video_url FROM '(?:v=|/embed/|youtu\.be/)([A-Za-z0-9_-]{11})')
                  || '" width="100%" height="400" frameborder="0" allowfullscreen="true" loading="lazy"></iframe></div>'
 WHERE video_url IS NOT NULL
   AND video_url ~ '(?:v=|/embed/|youtu\.be/)[A-Za-z0-9_-]{11}';

ALTER TABLE chapter_blocks DROP COLUMN video_url;

-- 2. Preserve legacy chapters.content by promoting it to a leading text
--    block on the same chapter. Shift any existing blocks one slot down
--    so the preserved content always appears first.
WITH affected AS (
  SELECT id AS chapter_id FROM chapters WHERE content IS NOT NULL
)
UPDATE chapter_blocks cb
   SET order_index = order_index + 1
  FROM affected a
 WHERE cb.chapter_id = a.chapter_id;

INSERT INTO chapter_blocks (id, chapter_id, block_type, order_index, content)
SELECT gen_random_uuid(), id, 'text', 0, content
  FROM chapters
 WHERE content IS NOT NULL;

ALTER TABLE chapters DROP COLUMN content;
ALTER TABLE chapters DROP COLUMN video_url;

-- 3. Drop course-level start/end dates (always null in prod; replaced by
--    the cohort model).
ALTER TABLE courses DROP COLUMN start_date;
ALTER TABLE courses DROP COLUMN end_date;

-- 4. Tighten the chapter_blocks block_type CHECK to match the current
--    BLOCK_TYPES literal in backend/app/schemas/chapter_block.py.
ALTER TABLE chapter_blocks DROP CONSTRAINT IF EXISTS chapter_blocks_block_type_check;
ALTER TABLE chapter_blocks
  ADD CONSTRAINT chapter_blocks_block_type_check
  CHECK (block_type IN ('text', 'quiz', 'assignment', 'file'));

-- 5. Tighten the chapters chapter_type CHECK to match CHAPTER_TYPES in
--    backend/app/schemas/course.py. All existing rows are already within
--    the new set (verified pre-migration).
ALTER TABLE chapters DROP CONSTRAINT IF EXISTS chapters_chapter_type_check;
ALTER TABLE chapters
  ADD CONSTRAINT chapters_chapter_type_check
  CHECK (chapter_type IN ('reading', 'quiz', 'exam', 'assignment'));
