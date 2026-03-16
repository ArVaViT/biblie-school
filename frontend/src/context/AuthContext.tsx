import { useState, useCallback, useEffect, useRef, useMemo } from "react"
import type { User } from "@/types"
import { supabase } from "@/lib/supabase"
import { authService } from "@/services/auth"
import type { User as SupabaseUser } from "@supabase/supabase-js"
import { AuthContext } from "./auth-context"

function userFromSupabase(su: SupabaseUser): User {
  return {
    id: su.id,
    email: su.email ?? "",
    full_name: su.user_metadata?.full_name ?? null,
    avatar_url: su.user_metadata?.avatar_url ?? null,
    role: su.user_metadata?.role ?? "student",
    created_at: su.created_at,
    updated_at: su.updated_at ?? "",
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const mounted = useRef(true)

  const enrichProfile = useCallback((userId: string, email: string) => {
    supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single()
      .then(({ data }) => {
        if (!mounted.current || !data) return
        setUser({
          id: data.id,
          email: data.email || email,
          full_name: data.full_name,
          avatar_url: data.avatar_url ?? null,
          role: data.role,
          created_at: data.created_at,
          updated_at: data.updated_at,
        })
      })
      .then(() => {}, () => {})
  }, [])

  useEffect(() => {
    mounted.current = true

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!mounted.current) return

        if (event === "INITIAL_SESSION") {
          if (session?.user) {
            setUser(userFromSupabase(session.user))
            enrichProfile(session.user.id, session.user.email ?? "")
          }
          setLoading(false)
          return
        }

        if (event === "SIGNED_IN" && session?.user) {
          setUser(userFromSupabase(session.user))
          enrichProfile(session.user.id, session.user.email ?? "")
          return
        }

        if (event === "TOKEN_REFRESHED" && session?.user) {
          enrichProfile(session.user.id, session.user.email ?? "")
          return
        }

        if (event === "SIGNED_OUT") {
          setUser(null)
        }
      },
    )

    return () => {
      mounted.current = false
      subscription.unsubscribe()
    }
  }, [enrichProfile])

  const login = useCallback(async (email: string, password: string) => {
    const { user: su } = await authService.login(email, password)
    if (su) setUser(userFromSupabase(su))
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

  const refreshUser = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) {
      if (mounted.current) setUser(null)
      return
    }
    setUser(userFromSupabase(session.user))
    enrichProfile(session.user.id, session.user.email ?? "")
  }, [enrichProfile])

  const logout = useCallback(async () => {
    try { await authService.logout() } catch { /* ignore */ }
    setUser(null)
  }, [])

  const value = useMemo(
    () => ({ user, loading, login, register, signInWithGoogle, resetPassword, logout, refreshUser }),
    [user, loading, login, register, signInWithGoogle, resetPassword, logout, refreshUser],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
