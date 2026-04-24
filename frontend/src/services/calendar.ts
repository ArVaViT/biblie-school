import api from "./api"
import { cacheGet, cacheSet, cacheInvalidate, cacheInvalidatePrefix } from "@/lib/cache"
import type { CalendarEvent, CourseEvent } from "@/types"

export const calendarService = {
  async getCalendarEvents(courseId?: string): Promise<CalendarEvent[]> {
    const key = `calendar:events:${courseId ?? "all"}`
    const cached = cacheGet<CalendarEvent[]>(key)
    if (cached) return cached
    const params = courseId ? { course_id: courseId } : undefined
    const response = await api.get<CalendarEvent[]>("/calendar/events", { params })
    cacheSet(key, response.data, 60 * 1000)
    return response.data
  },

  async getCourseEvents(courseId: string): Promise<CourseEvent[]> {
    const key = `calendar:course-events:${courseId}`
    const cached = cacheGet<CourseEvent[]>(key)
    if (cached) return cached
    const response = await api.get<CourseEvent[]>(`/courses/${courseId}/events`)
    cacheSet(key, response.data, 2 * 60 * 1000)
    return response.data
  },

  async createCourseEvent(
    courseId: string,
    data: {
      title: string
      description?: string
      event_type?: string
      event_date: string
    },
  ): Promise<CourseEvent> {
    const response = await api.post<CourseEvent>(`/courses/${courseId}/events`, data)
    cacheInvalidate(`calendar:course-events:${courseId}`)
    cacheInvalidatePrefix("calendar:events:")
    return response.data
  },

  async updateCourseEvent(
    courseId: string,
    eventId: string,
    data: {
      title?: string
      description?: string
      event_type?: string
      event_date?: string
    },
  ): Promise<CourseEvent> {
    const response = await api.put<CourseEvent>(
      `/courses/${courseId}/events/${eventId}`,
      data,
    )
    cacheInvalidate(`calendar:course-events:${courseId}`)
    cacheInvalidatePrefix("calendar:events:")
    return response.data
  },

  async deleteCourseEvent(courseId: string, eventId: string): Promise<void> {
    await api.delete(`/courses/${courseId}/events/${eventId}`)
    cacheInvalidate(`calendar:course-events:${courseId}`)
    cacheInvalidatePrefix("calendar:events:")
  },
}
