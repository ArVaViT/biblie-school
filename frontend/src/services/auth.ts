import { supabase } from "@/lib/supabase"
import type { Session } from "@supabase/supabase-js"

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
}
