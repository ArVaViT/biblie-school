import api from "./api"
import { cacheGet, cacheSet, cacheInvalidate, cacheInvalidatePrefix } from "@/lib/cache"
import type { Announcement } from "@/types"

export const announcementsService = {
  async getAnnouncements(courseId?: string): Promise<Announcement[]> {
    const key = courseId ? `announcements:course:${courseId}` : `announcements:global`
    const cached = cacheGet<Announcement[]>(key)
    if (cached) return cached
    const params = courseId ? { course_id: courseId } : undefined
    const response = await api.get<Announcement[]>("/announcements", { params })
    cacheSet(key, response.data, 2 * 60 * 1000)
    return response.data
  },

  async createAnnouncement(data: {
    title: string
    content: string
    course_id?: string
  }): Promise<Announcement> {
    const response = await api.post<Announcement>("/announcements", data)
    cacheInvalidate(`announcements:global`)
    if (data.course_id) cacheInvalidate(`announcements:course:${data.course_id}`)
    return response.data
  },

  async deleteAnnouncement(id: string): Promise<void> {
    await api.delete(`/announcements/${id}`)
    cacheInvalidatePrefix(`announcements:`)
  },
}
