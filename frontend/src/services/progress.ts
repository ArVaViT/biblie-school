import api from "./api"
import { cacheGet, cacheSet, cacheInvalidatePrefix } from "@/lib/cache"
import type { StudentProgressResponse } from "@/types"

export const progressService = {
  async teacherMarkComplete(chapterId: string, studentId: string): Promise<void> {
    await api.put(`/progress/chapter/${chapterId}/student/${studentId}/complete`)
    cacheInvalidatePrefix("progress:students:")
    cacheInvalidatePrefix("analytics:course:")
  },

  async teacherMarkIncomplete(chapterId: string, studentId: string): Promise<void> {
    await api.put(`/progress/chapter/${chapterId}/student/${studentId}/incomplete`)
    cacheInvalidatePrefix("progress:students:")
    cacheInvalidatePrefix("analytics:course:")
  },

  async getMyChapterProgress(courseId: string): Promise<string[]> {
    const key = `progress:my:${courseId}`
    const cached = cacheGet<string[]>(key)
    if (cached) return cached
    const response = await api.get<string[]>(`/progress/course/${courseId}/my-progress`)
    cacheSet(key, response.data, 60 * 1000)
    return response.data
  },

  async getStudentProgress(courseId: string): Promise<StudentProgressResponse> {
    const key = `progress:students:${courseId}`
    const cached = cacheGet<StudentProgressResponse>(key)
    if (cached) return cached
    const response = await api.get<StudentProgressResponse>(
      `/progress/course/${courseId}/students`,
    )
    cacheSet(key, response.data, 30 * 1000)
    return response.data
  },
}
