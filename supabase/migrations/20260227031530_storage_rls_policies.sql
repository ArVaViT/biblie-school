-- Supabase migration: storage_rls_policies
-- Version: 20260227031530

-- =============================================
-- AVATARS (public bucket)
-- =============================================

-- Anyone can view avatars
CREATE POLICY "avatars_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

-- Users can upload their own avatar (path: avatars/<user_id>/...)
CREATE POLICY "avatars_owner_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can update their own avatar
CREATE POLICY "avatars_owner_update"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can delete their own avatar
CREATE POLICY "avatars_owner_delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- =============================================
-- COURSE-ASSETS (public bucket — thumbnails, previews)
-- =============================================

-- Anyone can view course assets
CREATE POLICY "course_assets_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'course-assets');

-- Teachers/admins can upload course assets (path: course-assets/<course_id>/...)
CREATE POLICY "course_assets_teacher_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'course-assets'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('teacher', 'admin')
    )
  );

-- Teachers/admins can update course assets
CREATE POLICY "course_assets_teacher_update"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'course-assets'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('teacher', 'admin')
    )
  );

-- Teachers/admins can delete course assets
CREATE POLICY "course_assets_teacher_delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'course-assets'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('teacher', 'admin')
    )
  );

-- =============================================
-- COURSE-MATERIALS (private — PDFs, audio, docs)
-- =============================================

-- Enrolled students + course owner + admins can read
CREATE POLICY "course_materials_enrolled_read"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'course-materials'
    AND (
      -- Admin can read everything
      EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin'
      )
      OR
      -- Course owner (teacher) can read their course materials
      EXISTS (
        SELECT 1 FROM public.courses
        WHERE id = (storage.foldername(name))[1]
          AND created_by = auth.uid()
      )
      OR
      -- Enrolled student can read
      EXISTS (
        SELECT 1 FROM public.enrollments
        WHERE course_id = (storage.foldername(name))[1]
          AND user_id = auth.uid()
      )
    )
  );

-- Teachers can upload to their own courses, admins to any
CREATE POLICY "course_materials_teacher_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'course-materials'
    AND (
      EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin'
      )
      OR
      EXISTS (
        SELECT 1 FROM public.courses
        WHERE id = (storage.foldername(name))[1]
          AND created_by = auth.uid()
      )
    )
  );

-- Teachers can update their own course materials
CREATE POLICY "course_materials_teacher_update"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'course-materials'
    AND (
      EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin'
      )
      OR
      EXISTS (
        SELECT 1 FROM public.courses
        WHERE id = (storage.foldername(name))[1]
          AND created_by = auth.uid()
      )
    )
  );

-- Teachers can delete their own course materials
CREATE POLICY "course_materials_teacher_delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'course-materials'
    AND (
      EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin'
      )
      OR
      EXISTS (
        SELECT 1 FROM public.courses
        WHERE id = (storage.foldername(name))[1]
          AND created_by = auth.uid()
      )
    )
  );
