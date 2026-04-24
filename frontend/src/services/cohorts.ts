import api from "./api"
import { cacheGet, cacheSet, cacheInvalidate, cacheInvalidatePrefix } from "@/lib/cache"
import type { Cohort } from "@/types"

export type CohortMutation = {
  name: string
  start_date: string
  end_date: string
  enrollment_start?: string | null
  enrollment_end?: string | null
  max_students?: number | null
  status?: Cohort["status"]
}

export const cohortsService = {
  async getCourseCohorts(courseId: string): Promise<Cohort[]> {
    const key = `cohorts:course:${courseId}`
    const cached = cacheGet<Cohort[]>(key)
    if (cached) return cached
    const response = await api.get<Cohort[]>(`/cohorts/course/${courseId}`)
    cacheSet(key, response.data, 2 * 60 * 1000)
    return response.data
  },

  async createCohort(courseId: string, data: CohortMutation): Promise<Cohort> {
    const response = await api.post<Cohort>(`/cohorts/course/${courseId}`, data)
    cacheInvalidate(`cohorts:course:${courseId}`)
    return response.data
  },

  async updateCohort(cohortId: string, data: Partial<CohortMutation>): Promise<Cohort> {
    const response = await api.put<Cohort>(`/cohorts/${cohortId}`, data)
    cacheInvalidatePrefix("cohorts:course:")
    return response.data
  },

  async deleteCohort(cohortId: string): Promise<void> {
    await api.delete(`/cohorts/${cohortId}`)
    cacheInvalidatePrefix("cohorts:course:")
  },

  async completeCohort(cohortId: string): Promise<void> {
    await api.post(`/cohorts/${cohortId}/complete`)
    cacheInvalidatePrefix("cohorts:course:")
  },
}
