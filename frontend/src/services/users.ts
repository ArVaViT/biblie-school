import { supabase } from "@/lib/supabase"
import type { Profile } from "@/types"

export const usersService = {
  async updateProfile(data: { full_name?: string }): Promise<Profile> {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) throw new Error("Not authenticated")

    const { data: profile, error } = await supabase
      .from("profiles")
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq("id", session.user.id)
      .select()
      .single()

    if (error) throw error
    return profile as Profile
  },
}
