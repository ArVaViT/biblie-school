import api from "./api"
import { supabase } from "@/lib/supabase"
import type { Course, Module, Chapter, Enrollment, ChapterProgress } from "../types"

export const coursesService = {
  async getCourses(search?: string): Promise<Course[]> {
    const params = search ? { search } : undefined
    const response = await api.get<Course[]>("/courses", { params })
    return response.data
  },

  async getCourse(id: string): Promise<Course> {
    const response = await api.get<Course>(`/courses/${id}`)
    return response.data
  },

  async getModule(courseId: string, moduleId: string): Promise<Module> {
    const response = await api.get<Module>(`/courses/${courseId}/modules/${moduleId}`)
    return response.data
  },

  // Enrollment
  async enrollInCourse(courseId: string): Promise<Enrollment> {
    const response = await api.post<Enrollment>(`/courses/${courseId}/enroll`)
    return response.data
  },

  async getMyCourses(): Promise<Enrollment[]> {
    const response = await api.get<Enrollment[]>("/users/me/courses")
    return response.data
  },

  async updateProgress(courseId: string, progress: number): Promise<Enrollment> {
    const response = await api.put<Enrollment>(
      `/courses/${courseId}/progress`,
      null,
      { params: { progress } },
    )
    return response.data
  },

  // Chapter progress (via Supabase direct)
  async getChapterProgress(chapterIds: string[]): Promise<ChapterProgress[]> {
    if (chapterIds.length === 0) return []
    const { data, error } = await supabase
      .from("chapter_progress")
      .select("*")
      .in("chapter_id", chapterIds)
    if (error) throw error
    return data ?? []
  },

  async markChapterComplete(chapterId: string): Promise<ChapterProgress> {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) throw new Error("Not authenticated")

    const { data, error } = await supabase
      .from("chapter_progress")
      .upsert(
        { user_id: session.user.id, chapter_id: chapterId },
        { onConflict: "user_id,chapter_id" },
      )
      .select()
      .single()

    if (error) throw error
    return data
  },

  async unmarkChapterComplete(chapterId: string): Promise<void> {
    const { error } = await supabase
      .from("chapter_progress")
      .delete()
      .eq("chapter_id", chapterId)

    if (error) throw error
  },

  // Teacher analytics (via Supabase direct)
  async getCourseAnalytics(courseId: string) {
    const { data: enrollments, error: eErr } = await supabase
      .from("enrollments")
      .select("id, user_id, progress, enrolled_at")
      .eq("course_id", courseId)

    if (eErr) throw eErr

    const userIds = (enrollments ?? []).map((e) => e.user_id)
    let students: { id: string; full_name: string | null; email: string }[] = []
    if (userIds.length > 0) {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", userIds)
      students = data ?? []
    }

    return {
      totalStudents: enrollments?.length ?? 0,
      enrollments: (enrollments ?? []).map((e) => ({
        ...e,
        student: students.find((s) => s.id === e.user_id),
      })),
      avgProgress: enrollments && enrollments.length > 0
        ? Math.round(enrollments.reduce((sum, e) => sum + e.progress, 0) / enrollments.length)
        : 0,
      completedCount: enrollments?.filter((e) => e.progress >= 100).length ?? 0,
    }
  },

  // Admin: all users
  async getAllUsers() {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false })

    if (error) throw error
    return data ?? []
  },

  async updateUserRole(userId: string, role: string) {
    const { error } = await supabase
      .from("profiles")
      .update({ role })
      .eq("id", userId)

    if (error) throw error
  },

  // Teacher CRUD — Courses
  async getTeacherCourses(): Promise<Course[]> {
    const response = await api.get<Course[]>("/courses/my")
    return response.data
  },

  async createCourse(data: { title: string; description?: string; image_url?: string }): Promise<Course> {
    const response = await api.post<Course>("/courses", data)
    return response.data
  },

  async updateCourse(
    id: string,
    data: { title?: string; description?: string; image_url?: string; status?: string },
  ): Promise<Course> {
    const response = await api.put<Course>(`/courses/${id}`, data)
    return response.data
  },

  async deleteCourse(id: string): Promise<void> {
    await api.delete(`/courses/${id}`)
  },

  // Teacher CRUD — Modules
  async createModule(
    courseId: string,
    data: { title: string; description?: string; order_index?: number },
  ): Promise<Module> {
    const response = await api.post<Module>(`/courses/${courseId}/modules`, data)
    return response.data
  },

  async updateModule(
    courseId: string,
    moduleId: string,
    data: { title?: string; description?: string; order_index?: number },
  ): Promise<Module> {
    const response = await api.put<Module>(`/courses/${courseId}/modules/${moduleId}`, data)
    return response.data
  },

  async deleteModule(courseId: string, moduleId: string): Promise<void> {
    await api.delete(`/courses/${courseId}/modules/${moduleId}`)
  },

  // Teacher CRUD — Chapters
  async createChapter(
    courseId: string,
    moduleId: string,
    data: { title: string; content?: string; video_url?: string; order_index?: number },
  ): Promise<Chapter> {
    const response = await api.post<Chapter>(
      `/courses/${courseId}/modules/${moduleId}/chapters`,
      data,
    )
    return response.data
  },

  async updateChapter(
    courseId: string,
    moduleId: string,
    chapterId: string,
    data: { title?: string; content?: string; video_url?: string; order_index?: number },
  ): Promise<Chapter> {
    const response = await api.put<Chapter>(
      `/courses/${courseId}/modules/${moduleId}/chapters/${chapterId}`,
      data,
    )
    return response.data
  },

  async deleteChapter(
    courseId: string,
    moduleId: string,
    chapterId: string,
  ): Promise<void> {
    await api.delete(`/courses/${courseId}/modules/${moduleId}/chapters/${chapterId}`)
  },
}
