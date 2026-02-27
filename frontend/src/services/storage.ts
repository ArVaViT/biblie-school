import { supabase } from "@/lib/supabase"

const AVATARS_BUCKET = "avatars"
const COURSE_ASSETS_BUCKET = "course-assets"
const COURSE_MATERIALS_BUCKET = "course-materials"

function getPublicUrl(bucket: string, path: string): string {
  const { data } = supabase.storage.from(bucket).getPublicUrl(path)
  return data.publicUrl
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
    const path = `${courseId}/${timestamp}-${file.name}`

    const { error } = await supabase.storage
      .from(COURSE_MATERIALS_BUCKET)
      .upload(path, file)

    if (error) throw error

    const { data } = await supabase.storage
      .from(COURSE_MATERIALS_BUCKET)
      .createSignedUrl(path, 3600)

    return {
      url: data?.signedUrl ?? path,
      name: file.name,
      type: file.type,
    }
  },

  async listCourseMaterials(courseId: string) {
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
}
