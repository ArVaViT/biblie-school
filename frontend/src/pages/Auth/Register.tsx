import { useState } from "react"
import { useNavigate, Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { useAuth } from "@/context/AuthContext"
import { registerSchema } from "@/lib/validations/auth"
import { GraduationCap, BookOpenCheck } from "lucide-react"

type FormState = {
  full_name: string
  email: string
  password: string
  confirmPassword: string
  role: "teacher" | "student"
}

export default function Register() {
  const [form, setForm] = useState<FormState>({
    full_name: "",
    email: "",
    password: "",
    confirmPassword: "",
    role: "student",
  })
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({})
  const [serverError, setServerError] = useState("")
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const { register, signInWithGoogle } = useAuth()
  const navigate = useNavigate()

  const handleChange = (field: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
    setErrors((prev) => ({ ...prev, [field]: undefined }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setServerError("")

    const result = registerSchema.safeParse(form)
    if (!result.success) {
      const fieldErrors: typeof errors = {}
      for (const issue of result.error.issues) {
        const key = String(issue.path[0])
        if (!fieldErrors[key]) fieldErrors[key] = issue.message
      }
      setErrors(fieldErrors)
      return
    }

    setLoading(true)
    try {
      await register(result.data.email, result.data.password, result.data.full_name, result.data.role)
      setSuccess(true)
    } catch (err: unknown) {
      const supaErr = err as { message?: string }
      setServerError(supaErr.message || "Registration failed. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleSignUp = async () => {
    try {
      await signInWithGoogle()
    } catch (err: unknown) {
      const supaErr = err as { message?: string }
      setServerError(supaErr.message || "Google sign-up failed.")
    }
  }

  if (success) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-7rem)] px-4">
        <Card className="w-full max-w-md shadow-lg animate-fade-in">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl tracking-tight">Check Your Email</CardTitle>
            <CardDescription className="mt-2">
              We sent a confirmation link to <strong>{form.email}</strong>.
              Please check your inbox and click the link to activate your account.
            </CardDescription>
          </CardHeader>
          <CardFooter className="flex flex-col gap-4">
            <Button variant="outline" className="w-full" onClick={() => navigate("/login")}>
              Back to Sign In
            </Button>
          </CardFooter>
        </Card>
      </div>
    )
  }

  const roles = [
    {
      value: "student" as const,
      label: "Student",
      description: "Enroll in courses and learn",
      icon: GraduationCap,
    },
    {
      value: "teacher" as const,
      label: "Teacher",
      description: "Create and manage courses",
      icon: BookOpenCheck,
    },
  ]

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-7rem)] px-4 py-8">
      <Card className="w-full max-w-md shadow-lg animate-fade-in">
        <CardHeader className="text-center pb-2">
          <CardTitle className="text-2xl tracking-tight">Create Account</CardTitle>
          <CardDescription>Choose your role and get started</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-5 pt-4">
            {serverError && (
              <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
                {serverError}
              </div>
            )}

            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={handleGoogleSignUp}
            >
              <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              Continue with Google
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">or</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label>I am a</Label>
              <div className="grid grid-cols-2 gap-3">
                {roles.map((r) => {
                  const Icon = r.icon
                  const selected = form.role === r.value
                  return (
                    <button
                      key={r.value}
                      type="button"
                      onClick={() => handleChange("role", r.value)}
                      className={`relative flex flex-col items-center gap-1.5 rounded-lg border-2 p-4 transition-all ${
                        selected
                          ? "border-primary bg-primary/5 shadow-sm"
                          : "border-border hover:border-muted-foreground/30"
                      }`}
                    >
                      <Icon className={`h-6 w-6 ${selected ? "text-primary" : "text-muted-foreground"}`} />
                      <span className={`text-sm font-medium ${selected ? "text-primary" : ""}`}>
                        {r.label}
                      </span>
                      <span className="text-[11px] text-muted-foreground text-center leading-tight">
                        {r.description}
                      </span>
                    </button>
                  )
                })}
              </div>
              {errors.role && <p className="text-xs text-destructive">{errors.role}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name</Label>
              <Input
                id="fullName"
                placeholder="John Doe"
                value={form.full_name}
                onChange={(e) => handleChange("full_name", e.target.value)}
                aria-invalid={!!errors.full_name}
              />
              {errors.full_name && <p className="text-xs text-destructive">{errors.full_name}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={form.email}
                onChange={(e) => handleChange("email", e.target.value)}
                aria-invalid={!!errors.email}
              />
              {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={form.password}
                onChange={(e) => handleChange("password", e.target.value)}
                aria-invalid={!!errors.password}
              />
              {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={form.confirmPassword}
                onChange={(e) => handleChange("confirmPassword", e.target.value)}
                aria-invalid={!!errors.confirmPassword}
              />
              {errors.confirmPassword && (
                <p className="text-xs text-destructive">{errors.confirmPassword}</p>
              )}
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Creating account..." : "Create Account"}
            </Button>
            <p className="text-xs text-center text-muted-foreground">
              Already have an account?{" "}
              <Link to="/login" className="text-primary hover:underline font-medium">
                Sign In
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
