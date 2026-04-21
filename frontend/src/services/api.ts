import axios, { isAxiosError } from "axios"
import type { AxiosRequestConfig, AxiosResponse, InternalAxiosRequestConfig } from "axios"
import { supabase } from "@/lib/supabase"

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000"
const cleanApiUrl = API_URL.replace(/\/+$/, "")

const api = axios.create({
  baseURL: `${cleanApiUrl}/api/v1`,
  headers: { "Content-Type": "application/json" },
})

type RetriableConfig = InternalAxiosRequestConfig & { _retry?: boolean }

let cachedToken: string | null = null

// Prime the cache on module load, and keep it in sync with Supabase auth events.
// Before the first `getSession()` resolves we fall back to a live lookup inside
// the request interceptor so early calls still ship an Authorization header.
let primed: Promise<void> | null = supabase.auth
  .getSession()
  .then(({ data }) => {
    cachedToken = data.session?.access_token ?? null
  })
  .catch(() => {
    cachedToken = null
  })
  .finally(() => {
    primed = null
  })

supabase.auth.onAuthStateChange((_event, session) => {
  cachedToken = session?.access_token ?? null
})

async function getAccessToken(): Promise<string | null> {
  if (cachedToken) return cachedToken
  if (primed) {
    try {
      await primed
    } catch {
      // `primed` itself swallows errors; leave cachedToken null.
    }
  }
  return cachedToken
}

api.interceptors.request.use(async (config) => {
  const token = await getAccessToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (!isAxiosError(error) || error.response?.status !== 401) {
      return Promise.reject(error)
    }

    const original = error.config as RetriableConfig | undefined
    if (!original || original._retry) {
      return Promise.reject(error)
    }
    original._retry = true

    // Try to transparently recover from a stale/expired access token before
    // ejecting the user. A truly invalid session — refresh fails or the retry
    // still returns 401 — falls through to signOut so the UI re-renders to the
    // auth screens instead of looping.
    try {
      const { data, error: refreshError } = await supabase.auth.refreshSession()
      const newToken = data.session?.access_token ?? null
      if (refreshError || !newToken) {
        cachedToken = null
        await supabase.auth.signOut()
        return Promise.reject(error)
      }
      cachedToken = newToken
      original.headers = original.headers ?? {}
      original.headers.Authorization = `Bearer ${newToken}`
      return api.request(original)
    } catch {
      cachedToken = null
      await supabase.auth.signOut()
      return Promise.reject(error)
    }
  },
)

const inflight = new Map<string, Promise<AxiosResponse<unknown>>>()

function dedupeKey(url: string, token: string | null, params?: Record<string, unknown>): string {
  // Include the auth token in the key so a request that fires right before
  // login doesn't get its unauthenticated response served to a logged-in
  // caller a millisecond later.
  const tokenBucket = token ? token.slice(-12) : "anon"
  return params ? `${url}?${JSON.stringify(params)}|${tokenBucket}` : `${url}|${tokenBucket}`
}

const originalGet = api.get.bind(api)

api.get = function dedupedGet<T = unknown, R = AxiosResponse<T>, D = unknown>(
  url: string,
  config?: AxiosRequestConfig<D>,
): Promise<R> {
  const key = dedupeKey(url, cachedToken, config?.params as Record<string, unknown> | undefined)
  const existing = inflight.get(key)
  if (existing) return existing as Promise<R>

  const promise = originalGet<T, R, D>(url, config).finally(() => {
    inflight.delete(key)
  })
  inflight.set(key, promise as Promise<AxiosResponse<unknown>>)
  return promise
} as typeof api.get

export default api
