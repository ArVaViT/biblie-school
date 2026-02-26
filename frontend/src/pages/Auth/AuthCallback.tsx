import { useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { supabase } from "@/lib/supabase"

export default function AuthCallback() {
  const navigate = useNavigate()

  useEffect(() => {
    supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "PASSWORD_RECOVERY") {
        if (event === "PASSWORD_RECOVERY") {
          navigate("/auth/reset-password", { replace: true })
        } else {
          navigate("/dashboard", { replace: true })
        }
      }
    })
  }, [navigate])

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <span className="text-sm text-muted-foreground">Completing sign in...</span>
      </div>
    </div>
  )
}
