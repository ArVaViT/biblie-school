import { supabase } from "@/lib/supabase"

const AVATARS_BUCKET = "avatars"
const COURSE_ASSETS_BUCKET = "course-assets"
const COURSE_MATERIALS_BUCKET = "course-materials"

// Signed-URL TTL for on-demand downloads. One hour is plenty for a user to
// click → browser to start the download, and keeps blast radius tight if a
// URL leaks (e.g. copied from the address bar into a chat). We re-sign
// every time the link is clicked, so the secret can rotate without
// breaking anything in the DB.
const SIGNED_URL_TTL_SECONDS = 60 * 60

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

interface UploadedBlockFile {
  bucket: string
  path: string
  name: string
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

  /**
   * Upload a course material file into the private `course-materials` bucket.
   * Returns nothing — every caller refreshes its own list afterwards and
   * signs URLs on demand via `getSignedMaterialUrl`. Previously this minted
   * a 1-year signed URL as a workaround for short TTLs; that bandaid is
   * gone now that chapter file blocks re-sign on click too.
   */
  async uploadCourseMaterial(courseId: string, file: File): Promise<void> {
    const timestamp = Date.now()
    const safeName = sanitizeFileName(file.name)
    const path = `${courseId}/${timestamp}-${safeName}`

    const { error } = await supabase.storage
      .from(COURSE_MATERIALS_BUCKET)
      .upload(path, file)

    if (error) throw error
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
      .createSignedUrl(path, SIGNED_URL_TTL_SECONDS)

    if (error) throw error
    return data.signedUrl
  },

  async deleteCourseMaterial(path: string): Promise<void> {
    const { error } = await supabase.storage
      .from(COURSE_MATERIALS_BUCKET)
      .remove([path])

    if (error) throw error
  },

  /**
   * Upload a file attached to a chapter block. The caller persists the
   * returned `{ bucket, path, name }` on the block and re-signs the URL
   * every time a student opens the file. Nothing JWT-secret-dependent
   * is ever stored in the database, so rotating the Supabase JWT secret
   * doesn't invalidate anything.
   */
  async uploadBlockFile(chapterId: string, file: File): Promise<UploadedBlockFile> {
    const timestamp = Date.now()
    const safeName = sanitizeFileName(file.name)
    const path = `${chapterId}/${timestamp}-${safeName}`

    const { error } = await supabase.storage
      .from(COURSE_MATERIALS_BUCKET)
      .upload(path, file)

    if (error) throw error

    return { bucket: COURSE_MATERIALS_BUCKET, path, name: file.name }
  },

  /** Mint a short-lived signed URL for a block-attached file. */
  async getSignedBlockFileUrl(bucket: string, path: string): Promise<string> {
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, SIGNED_URL_TTL_SECONDS)

    if (error) throw error
    return data.signedUrl
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
