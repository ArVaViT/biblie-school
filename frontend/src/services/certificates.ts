import api from "./api"
import { isAxiosError } from "axios"
import type { Certificate } from "@/types"

export const certificatesService = {
  async getCourseCertificate(courseId: string): Promise<Certificate | null> {
    try {
      const response = await api.get<Certificate>(`/certificates/course/${courseId}`)
      return response.data
    } catch (err: unknown) {
      if (isAxiosError(err) && err.response?.status === 404) return null
      throw err
    }
  },

  async requestCertificate(courseId: string): Promise<Certificate> {
    const response = await api.post<Certificate>(`/certificates/course/${courseId}`)
    return response.data
  },

  async getMyCertificates(): Promise<Certificate[]> {
    const response = await api.get<Certificate[]>("/certificates/my")
    return response.data
  },

  async getPendingCertificates(): Promise<Certificate[]> {
    const response = await api.get<Certificate[]>("/certificates/pending")
    return response.data
  },

  async teacherApproveCert(certId: string): Promise<void> {
    await api.put(`/certificates/${certId}/teacher-approve`)
  },

  async adminApproveCert(certId: string): Promise<void> {
    await api.put(`/certificates/${certId}/admin-approve`)
  },

  async rejectCert(certId: string): Promise<void> {
    await api.put(`/certificates/${certId}/reject`)
  },

  async getAdminPendingCerts(): Promise<Certificate[]> {
    const response = await api.get<Certificate[]>("/certificates/admin/pending")
    return response.data
  },
}
