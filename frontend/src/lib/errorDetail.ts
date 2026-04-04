import { isAxiosError } from "axios"

export function getErrorDetail(err: unknown, fallback = "An error occurred"): string {
  if (isAxiosError(err)) {
    const detail: unknown = err.response?.data?.detail
    if (typeof detail === "string") return detail
    if (detail) return JSON.stringify(detail)
    const status = err.response?.status
    if (status === 401) return "Authentication required. Please sign in again."
    if (status === 403) return "You don't have permission for this action."
    if (status === 404) return "Resource not found."
    if (status === 500) return "Server error. Please try again later."
  }
  if (err instanceof Error) return err.message
  return fallback
}

export function getErrorStatus(err: unknown): number | undefined {
  if (isAxiosError(err)) return err.response?.status
  return undefined
}
