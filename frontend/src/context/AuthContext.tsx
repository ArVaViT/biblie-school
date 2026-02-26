import { createContext, useContext, useState, useCallback, useEffect, useRef, useMemo } from "react"
import type { User } from "@/types"
import { supabase } from "@/lib/supabase"
import { authService } from "@/services/auth"

interface AuthContextValue {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, fullName: string, role: "teacher" | "student") => Promise<void>
  signInWithGoogle: () => Promise<void>
  resetPassword: (email: string) => Promise<void>
  logout: () => void
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

const LOADING_TIMEOUT_MS = 6000

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const mounted = useRef(true)
  const initialised = useRef(false)

  const loadProfile = useCallback(async (userId: string, email: string): Promise<User | null> => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single()

      if (error || !data) return null

      return {
        id: data.id,
        email: data.email || email,
        full_name: data.full_name,
        role: data.role,
        created_at: data.created_at,
        updated_at: data.updated_at,
      }
    } catch {
      return null
    }
  }, [])

  useEffect(() => {
    mounted.current = true

    const timeout = setTimeout(() => {
      if (mounted.current && loading) setLoading(false)
    }, LOADING_TIMEOUT_MS)

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted.current) return

        if (event === "INITIAL_SESSION" || event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
          if (session?.user) {
            const profile = await loadProfile(session.user.id, session.user.email ?? "")
            if (mounted.current) setUser(profile)
          } else {
            if (mounted.current) setUser(null)
          }
        }

        if (event === "SIGNED_OUT") {
          if (mounted.current) setUser(null)
        }

        if (!initialised.current || event === "INITIAL_SESSION") {
          initialised.current = true
          if (mounted.current) {
            clearTimeout(timeout)
            setLoading(false)
          }
        }
      },
    )

    return () => {
      mounted.current = false
      clearTimeout(timeout)
      subscription.unsubscribe()
    }
  }, [loadProfile, loading])

  const refreshUser = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user) {
      const profile = await loadProfile(session.user.id, session.user.email ?? "")
      if (mounted.current) setUser(profile)
    } else {
      if (mounted.current) setUser(null)
    }
  }, [loadProfile])

  const login = useCallback(async (email: string, password: string) => {
    await authService.login(email, password)
  }, [])

  const register = useCallback(
    async (email: string, password: string, fullName: string, role: "teacher" | "student") => {
      await authService.register(email, password, fullName, role)
    },
    [],
  )

  const signInWithGoogle = useCallback(async () => {
    await authService.signInWithGoogle()
  }, [])

  const resetPassword = useCallback(async (email: string) => {
    await authService.resetPassword(email)
  }, [])

  const logout = useCallback(async () => {
    await authService.logout()
    setUser(null)
  }, [])

  const value = useMemo(
    () => ({ user, loading, login, register, signInWithGoogle, resetPassword, logout, refreshUser }),
    [user, loading, login, register, signInWithGoogle, resetPassword, logout, refreshUser],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}
