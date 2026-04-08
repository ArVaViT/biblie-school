import axios, { isAxiosError } from "axios"
import type { AxiosRequestConfig, AxiosResponse } from "axios"
import { supabase } from "@/lib/supabase"

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000"
const cleanApiUrl = API_URL.replace(/\/+$/, "")

const api = axios.create({
  baseURL: `${cleanApiUrl}/api/v1`,
  headers: { "Content-Type": "application/json" },
})

let _cachedToken: string | null = null
let _tokenReady: Promise<void>

_tokenReady = supabase.auth.getSession().then(({ data }) => {
  _cachedToken = data.session?.access_token ?? null
}).catch(() => {
  _cachedToken = null
})

supabase.auth.onAuthStateChange((_event, session) => {
  _cachedToken = session?.access_token ?? null
})

api.interceptors.request.use(async (config) => {
  await _tokenReady
  if (_cachedToken) {
    config.headers.Authorization = `Bearer ${_cachedToken}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (isAxiosError(error) && error.response?.status === 401) {
      _cachedToken = null
      await supabase.auth.signOut()
    }
    return Promise.reject(error)
  },
)

const inflight = new Map<string, Promise<AxiosResponse<unknown>>>()

function dedupeKey(url: string, params?: Record<string, unknown>): string {
  return params ? `${url}?${JSON.stringify(params)}` : url
}

const originalGet = api.get.bind(api)

api.get = function dedupedGet<T = unknown, R = AxiosResponse<T>, D = unknown>(
  url: string,
  config?: AxiosRequestConfig<D>,
): Promise<R> {
  const key = dedupeKey(url, config?.params as Record<string, unknown> | undefined)
  const existing = inflight.get(key)
  if (existing) return existing as Promise<R>

  const promise = originalGet<T, R, D>(url, config).finally(() => {
    inflight.delete(key)
  })
  inflight.set(key, promise as Promise<AxiosResponse<unknown>>)
  return promise
} as typeof api.get

export default api
