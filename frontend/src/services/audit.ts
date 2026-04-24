import api from "./api"
import type { AuditLogPage } from "@/types"

export type AuditLogQuery = {
  page?: number
  page_size?: number
  user_id?: string
  resource_type?: string
  action?: string
  date_from?: string
  date_to?: string
}

export const auditService = {
  async getAuditLogs(params: AuditLogQuery = {}): Promise<AuditLogPage> {
    const response = await api.get<AuditLogPage>("/audit", { params })
    return response.data
  },
}
