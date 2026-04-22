-- Supabase migration: create_storage_buckets
-- Version: 20260227031449

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('avatars', 'avatars', true, 2097152, ARRAY['image/jpeg','image/png','image/webp','image/gif']),
  ('course-assets', 'course-assets', true, 5242880, ARRAY['image/jpeg','image/png','image/webp','image/gif','image/svg+xml']),
  ('course-materials', 'course-materials', false, 52428800, ARRAY['application/pdf','audio/mpeg','audio/mp4','audio/ogg','audio/wav','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation','text/plain'])
ON CONFLICT (id) DO NOTHING;
