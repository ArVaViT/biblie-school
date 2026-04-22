-- Supabase migration: remove_public_bucket_listing_policies
-- Version: 20260421010827

-- Phase 1.1: public buckets don't need a broad SELECT policy for object-URL
-- access; the policy only enables listing of every file in the bucket, which
-- exposes more than intended. Public URLs keep working without it.

DROP POLICY IF EXISTS avatars_public_read ON storage.objects;
DROP POLICY IF EXISTS course_assets_public_read ON storage.objects;
