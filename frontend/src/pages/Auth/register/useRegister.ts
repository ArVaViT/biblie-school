import { useCallback, useState } from "react"
import { useAuth } from "@/context/useAuth"
import { registerSchema } from "@/lib/validations/auth"

export type FormState = {
  full_name: string
  email: string
  password: string
  confirmPassword: string
  role: "teacher" | "student"
}

const EMPTY_FORM: FormState = {
  full_name: "",
  email: "",
  password: "",
  confirmPassword: "",
  role: "student",
}

/**
 * Registration form state machine.
 *
 * Exposes the mutable form + per-field validation errors, the three
 * terminal states (server error, duplicate-email, success), and the two
 * async handlers (email/password submit and Google OAuth). The view just
 * renders whichever state is active; nothing else lives in the page.
 */
export function useRegister() {
  const { register, signInWithGoogle } = useAuth()
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({})
  const [serverError, setServerError] = useState("")
  const [duplicateEmail, setDuplicateEmail] = useState(false)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

  const handleChange = useCallback(
    (field: keyof FormState, value: string) => {
      setForm((prev) => ({ ...prev, [field]: value }))
      setErrors((prev) => ({ ...prev, [field]: undefined }))
    },
    [],
  )

  const handleSubmit = useCallback(async () => {
    setServerError("")

    const result = registerSchema.safeParse(form)
    if (!result.success) {
      const fieldErrors: Partial<Record<string, string>> = {}
      for (const issue of result.error.issues) {
        const key = String(issue.path[0])
        if (!fieldErrors[key]) fieldErrors[key] = issue.message
      }
      setErrors(fieldErrors)
      return
    }

    setLoading(true)
    try {
      await register(
        result.data.email,
        result.data.password,
        result.data.full_name,
        result.data.role,
      )
      setSuccess(true)
    } catch (err: unknown) {
      const supaErr = err as { message?: string }
      if (supaErr.message === "DUPLICATE_EMAIL") {
        setDuplicateEmail(true)
      } else {
        setServerError(supaErr.message || "Registration failed. Please try again.")
      }
    } finally {
      setLoading(false)
    }
  }, [form, register])

  const handleGoogleSignUp = useCallback(async () => {
    setGoogleLoading(true)
    try {
      await signInWithGoogle()
    } catch (err: unknown) {
      const supaErr = err as { message?: string }
      setServerError(supaErr.message || "Google sign-up failed.")
    } finally {
      setGoogleLoading(false)
    }
  }, [signInWithGoogle])

  return {
    form,
    errors,
    serverError,
    duplicateEmail,
    success,
    loading,
    googleLoading,
    handleChange,
    handleSubmit,
    handleGoogleSignUp,
  }
}
