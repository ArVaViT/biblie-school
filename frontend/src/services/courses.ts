import api from "./api"
import type { Course, Module, Chapter, Enrollment } from "../types"

export const coursesService = {
  // Public
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
    data: { title?: string; description?: string; image_url?: string },
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
    data: { title: string; content?: string; order_index?: number },
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
    data: { title?: string; content?: string; order_index?: number },
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
