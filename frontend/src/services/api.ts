import axios from "axios"
import { supabase } from "@/lib/supabase"

const API_URL = import.meta.env.VITE_API_URL || ""
const cleanApiUrl = API_URL.replace(/\/+$/, "")

const api = axios.create({
  baseURL: `${cleanApiUrl}/api/v1`,
  headers: { "Content-Type": "application/json" },
})

api.interceptors.request.use(async (config) => {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        await supabase.auth.signOut()
      }
    }
    return Promise.reject(error)
  },
)

export default api
