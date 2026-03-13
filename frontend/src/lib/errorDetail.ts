export function getErrorDetail(err: unknown, fallback = "An error occurred"): string {
  if (!err || typeof err !== "object") return fallback
  const axiosErr = err as { response?: { data?: { detail?: string }; status?: number } }
  const detail = axiosErr?.response?.data?.detail
  if (detail) return typeof detail === "string" ? detail : JSON.stringify(detail)
  const status = axiosErr?.response?.status
  if (status === 401) return "Authentication required. Please sign in again."
  if (status === 403) return "You don't have permission for this action."
  if (status === 404) return "Resource not found."
  if (status === 500) return "Server error. Please try again later."
  return fallback
}
