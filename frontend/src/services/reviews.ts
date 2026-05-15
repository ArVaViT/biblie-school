import api from "./api"
import { cacheGet, cacheSet, cacheInvalidate, cacheInvalidatePrefix, CACHE_TTL } from "@/lib/cache"
import type { CourseReview } from "@/types"

export const reviewsService = {
  async getCourseReviews(courseId: string): Promise<CourseReview[]> {
    const key = `reviews:course:${courseId}`
    const cached = cacheGet<CourseReview[]>(key)
    if (cached) return cached
    const response = await api.get<CourseReview[]>(`/reviews/course/${courseId}`)
    cacheSet(key, response.data, CACHE_TTL.TWO_MINUTES)
    return response.data
  },

  async submitReview(
    courseId: string,
    data: { rating: number; comment?: string },
  ): Promise<CourseReview> {
    const response = await api.post<CourseReview>(`/reviews/course/${courseId}`, data)
    cacheInvalidate(`reviews:course:${courseId}`)
    return response.data
  },

  async deleteReview(id: string): Promise<void> {
    await api.delete(`/reviews/${id}`)
    cacheInvalidatePrefix("reviews:course:")
  },
}
