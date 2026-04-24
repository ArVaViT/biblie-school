import api from "./api"
import { cacheGet, cacheSet } from "@/lib/cache"

interface CourseAnalyticsEnrollment {
  enrollment_id: string
  user_id: string
  full_name: string | null
  email: string
  progress: number
  enrolled_at: string | null
}

interface CourseAnalytics {
  course_id: string
  course_title: string
  total_students: number
  avg_progress: number
  completion_count: number
  enrollments: CourseAnalyticsEnrollment[]
}

export const analyticsService = {
  async getCourseAnalyticsAPI(courseId: string): Promise<CourseAnalytics> {
    const key = `analytics:course:${courseId}`
    const cached = cacheGet<CourseAnalytics>(key)
    if (cached) return cached
    const response = await api.get<CourseAnalytics>(`/analytics/course/${courseId}`)
    cacheSet(key, response.data, 30 * 1000)
    return response.data
  },
}
