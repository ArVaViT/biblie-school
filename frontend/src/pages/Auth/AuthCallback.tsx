import { useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { supabase } from "@/lib/supabase"

export default function AuthCallback() {
  const navigate = useNavigate()
  const handled = useRef(false)

  useEffect(() => {
    const go = (path: string) => {
      if (handled.current) return
      handled.current = true
      navigate(path, { replace: true })
    }

    const timeout = setTimeout(() => go("/login"), 8000)

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === "PASSWORD_RECOVERY") {
          clearTimeout(timeout)
          go("/auth/reset-password")
        } else if (session) {
          clearTimeout(timeout)
          go("/")
        }
      },
    )

    return () => {
      clearTimeout(timeout)
      subscription.unsubscribe()
    }
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
