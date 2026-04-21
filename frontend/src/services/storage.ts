import { supabase } from "@/lib/supabase"

const AVATARS_BUCKET = "avatars"
const COURSE_ASSETS_BUCKET = "course-assets"
const COURSE_MATERIALS_BUCKET = "course-materials"

function sanitizeFileName(name: string): string {
  return name.replace(/[/\\:*?"<>|]/g, "_").replace(/\s+/g, "_").slice(0, 100)
}

/**
 * Return a same-origin `/img/{bucket}/{path}` URL for public-bucket objects.
 * Vercel rewrites and Vite dev proxy map this to the Supabase Storage public
 * endpoint. Keeping the host the same bypasses AdBlock-style filters. The
 * path is used directly (no double URL-encoding); Supabase Storage expects
 * uploaded object keys as-is in the URL path.
 */
function getPublicUrl(bucket: string, path: string): string {
  return `/img/${bucket}/${path}`
}

export const storageService = {
  async uploadAvatar(userId: string, file: File): Promise<string> {
    const ext = file.name.split(".").pop() ?? "jpg"
    const path = `${userId}/avatar.${ext}`

    const { error } = await supabase.storage
      .from(AVATARS_BUCKET)
      .upload(path, file, { upsert: true })

    if (error) throw error
    return getPublicUrl(AVATARS_BUCKET, path)
  },

  async uploadCourseImage(courseId: string, file: File): Promise<string> {
    const ext = file.name.split(".").pop() ?? "jpg"
    const path = `${courseId}/cover.${ext}`

    const { error } = await supabase.storage
      .from(COURSE_ASSETS_BUCKET)
      .upload(path, file, { upsert: true })

    if (error) throw error
    return getPublicUrl(COURSE_ASSETS_BUCKET, path)
  },

  async uploadCourseMaterial(
    courseId: string,
    file: File,
  ): Promise<{ url: string; name: string; type: string }> {
    const timestamp = Date.now()
    const safeName = sanitizeFileName(file.name)
    const path = `${courseId}/${timestamp}-${safeName}`

    const { error } = await supabase.storage
      .from(COURSE_MATERIALS_BUCKET)
      .upload(path, file)

    if (error) throw error

    const { data: urlData, error: urlError } = await supabase.storage
      .from(COURSE_MATERIALS_BUCKET)
      .createSignedUrl(path, 3600)

    if (urlError || !urlData?.signedUrl) {
      throw urlError ?? new Error("Failed to create signed URL")
    }

    return {
      url: urlData.signedUrl,
      name: file.name,
      type: file.type,
    }
  },

  async listCourseMaterials(courseId: string): Promise<{ name: string; path: string; size: number | undefined; created: string | null }[]> {
    const { data, error } = await supabase.storage
      .from(COURSE_MATERIALS_BUCKET)
      .list(courseId, { sortBy: { column: "created_at", order: "desc" } })

    if (error) throw error
    return (data ?? []).map((f) => ({
      name: f.name,
      path: `${courseId}/${f.name}`,
      size: f.metadata?.size as number | undefined,
      created: f.created_at,
    }))
  },

  async getSignedMaterialUrl(path: string): Promise<string> {
    const { data, error } = await supabase.storage
      .from(COURSE_MATERIALS_BUCKET)
      .createSignedUrl(path, 3600)

    if (error) throw error
    return data.signedUrl
  },

  async deleteCourseMaterial(path: string): Promise<void> {
    const { error } = await supabase.storage
      .from(COURSE_MATERIALS_BUCKET)
      .remove([path])

    if (error) throw error
  },

  async uploadContentImage(file: File): Promise<string> {
    const ext = file.name.split(".").pop() ?? "jpg"
    const random = Math.random().toString(36).slice(2, 10)
    const path = `content-images/${Date.now()}-${random}.${ext}`

    const { error } = await supabase.storage
      .from(COURSE_ASSETS_BUCKET)
      .upload(path, file)

    if (error) throw error
    return getPublicUrl(COURSE_ASSETS_BUCKET, path)
  },
}
