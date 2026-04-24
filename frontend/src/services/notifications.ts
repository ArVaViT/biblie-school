import api from "./api"
import type { Notification, NotificationListResponse } from "@/types"

export const notificationsService = {
  async getNotifications(page: number = 1): Promise<NotificationListResponse> {
    const response = await api.get<NotificationListResponse>("/notifications", {
      params: { page },
    })
    return response.data
  },

  async getUnreadCount(): Promise<number> {
    const response = await api.get<{ count: number }>("/notifications/unread-count")
    return response.data.count
  },

  async markAsRead(id: string): Promise<Notification> {
    const response = await api.patch<Notification>(`/notifications/${id}/read`)
    return response.data
  },

  async markAllAsRead(): Promise<void> {
    await api.post("/notifications/read-all")
  },

  async deleteNotification(id: string): Promise<void> {
    await api.delete(`/notifications/${id}`)
  },
}
