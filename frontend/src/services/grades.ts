import api from "./api"
import { cacheGet, cacheSet, cacheInvalidate, cacheInvalidatePrefix } from "@/lib/cache"
import type { GradingConfig, GradeSummaryResponse, StudentGrade } from "@/types"

export const gradesService = {
  async getCourseGrades(courseId: string): Promise<StudentGrade[]> {
    const key = `grades:course:${courseId}`
    const cached = cacheGet<StudentGrade[]>(key)
    if (cached) return cached
    const response = await api.get<StudentGrade[]>(`/grades/course/${courseId}`)
    cacheSet(key, response.data, 60 * 1000)
    return response.data
  },

  async upsertGrade(
    courseId: string,
    studentId: string,
    data: { grade?: string; comment?: string },
  ): Promise<StudentGrade> {
    const response = await api.put<StudentGrade>(
      `/grades/course/${courseId}/student/${studentId}`,
      data,
    )
    cacheInvalidate(`grades:course:${courseId}`)
    cacheInvalidate(`grades:summary:${courseId}`)
    cacheInvalidatePrefix("grades:my")
    return response.data
  },

  async getMyGrades(): Promise<StudentGrade[]> {
    const key = "grades:my"
    const cached = cacheGet<StudentGrade[]>(key)
    if (cached) return cached
    const response = await api.get<StudentGrade[]>("/grades/my")
    cacheSet(key, response.data, 60 * 1000)
    return response.data
  },

  async updateGradingConfig(courseId: string, data: GradingConfig): Promise<GradingConfig> {
    const response = await api.put<GradingConfig>(`/grades/course/${courseId}/config`, data)
    cacheInvalidate(`grades:summary:${courseId}`)
    cacheInvalidate(`grades:course:${courseId}`)
    cacheInvalidate(`analytics:course:${courseId}`)
    return response.data
  },

  async getGradeSummary(courseId: string): Promise<GradeSummaryResponse> {
    const key = `grades:summary:${courseId}`
    const cached = cacheGet<GradeSummaryResponse>(key)
    if (cached) return cached
    const response = await api.get<GradeSummaryResponse>(
      `/grades/course/${courseId}/summary`,
    )
    cacheSet(key, response.data, 60 * 1000)
    return response.data
  },

  async exportGradesCSV(courseId: string): Promise<Blob> {
    const response = await api.get(`/grades/course/${courseId}/export-csv`, {
      responseType: "blob",
    })
    return response.data
  },
}
