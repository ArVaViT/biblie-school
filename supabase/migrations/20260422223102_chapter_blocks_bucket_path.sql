-- Supabase migration: chapter_blocks_bucket_path
-- Version: 20260422223102

ALTER TABLE chapter_blocks ADD COLUMN file_bucket VARCHAR(50);
ALTER TABLE chapter_blocks ADD COLUMN file_path TEXT;
ALTER TABLE chapter_blocks ADD COLUMN file_name VARCHAR(255);

UPDATE chapter_blocks
   SET file_bucket = substring(file_url FROM '/storage/v1/object/(?:sign|public)/([^/]+)/'),
       file_path = regexp_replace(
           substring(file_url FROM '/storage/v1/object/(?:sign|public)/[^/]+/(.+)$'),
           '\?.*$', ''
       )
 WHERE file_url LIKE '%/storage/v1/object/%';

UPDATE chapter_blocks
   SET file_bucket = substring(file_url FROM '^/img/([^/]+)/'),
       file_path = substring(file_url FROM '^/img/[^/]+/(.+)$')
 WHERE file_url LIKE '/img/%';

ALTER TABLE chapter_blocks DROP COLUMN file_url;
