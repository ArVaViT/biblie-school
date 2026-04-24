import api from "./api"
import { cacheGet, cacheSet, cacheInvalidate, cacheInvalidatePrefix } from "@/lib/cache"
import type { Enrollment } from "@/types"

export const enrollmentsService = {
  async enrollInCourse(courseId: string, cohortId?: string): Promise<Enrollment> {
    const response = await api.post<Enrollment>(
      `/courses/${courseId}/enroll`,
      cohortId ? { cohort_id: cohortId } : {},
    )
    cacheInvalidate("courses:my")
    cacheInvalidate(`courses:enrollment-status:${courseId}`)
    cacheInvalidatePrefix("calendar:events:")
    cacheInvalidatePrefix("progress:my:")
    return response.data
  },

  async getMyCourses(): Promise<Enrollment[]> {
    // HomePage, ProfilePage, CalendarPage, and CertificatesPage all call this
    // on mount. Without the short TTL we'd issue four identical requests for
    // /users/me/courses during a routine navigation.
    const key = "courses:my"
    const cached = cacheGet<Enrollment[]>(key)
    if (cached) return cached
    const response = await api.get<Enrollment[]>("/users/me/courses")
    cacheSet(key, response.data, 60 * 1000)
    return response.data
  },

  async getEnrollmentStatus(
    courseId: string,
  ): Promise<{ enrolled: boolean; enrollment: Enrollment | null }> {
    const key = `courses:enrollment-status:${courseId}`
    const cached = cacheGet<{ enrolled: boolean; enrollment: Enrollment | null }>(key)
    if (cached) return cached
    const response = await api.get<{ enrolled: boolean; enrollment: Enrollment | null }>(
      `/courses/${courseId}/enrollment-status`,
    )
    cacheSet(key, response.data, 60 * 1000)
    return response.data
  },
}
