import { supabase } from "@/lib/supabase"
import type { Session } from "@supabase/supabase-js"
import type { UserRole } from "@/types"

export const authService = {
  async register(
    email: string,
    password: string,
    fullName: string,
    role: "teacher" | "student" = "student",
  ): Promise<void> {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, role },
      },
    })
    if (error) throw error

    if (data.user && data.user.identities?.length === 0) {
      throw new Error("DUPLICATE_EMAIL")
    }
  },

  async login(email: string, password: string): Promise<{ user: Session["user"]; session: Session }> {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    if (error) throw error
    return data
  },

  async signInWithGoogle(): Promise<{ provider: string; url: string | null }> {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    if (error) throw error
    return data
  },

  async resetPassword(email: string): Promise<void> {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    })
    if (error) throw error
  },

  async updatePassword(password: string): Promise<void> {
    const { error } = await supabase.auth.updateUser({ password })
    if (error) throw error
  },

  async logout(): Promise<void> {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  },

  async getSession(): Promise<Session | null> {
    const { data } = await supabase.auth.getSession()
    return data.session
  },

  async getProfile(): Promise<{
    id: string
    email: string
    full_name: string | null
    role: UserRole
    created_at: string
    updated_at: string | null
  } | null> {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return null

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", session.user.id)
      .single()

    if (error) throw error
    return data
  },
}
