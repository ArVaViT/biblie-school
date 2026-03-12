import { useState } from "react"
import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/context/AuthContext"
import { registerSchema } from "@/lib/validations/auth"
import AuthLayout from "@/components/layout/AuthLayout"
import { GraduationCap, BookOpenCheck, Loader2, MailCheck, ArrowLeft, Clock, Mail } from "lucide-react"

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  )
}

type FormState = {
  full_name: string
  email: string
  password: string
  confirmPassword: string
  role: "teacher" | "student"
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
  const [duplicateEmail, setDuplicateEmail] = useState(false)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const { register, signInWithGoogle } = useAuth()

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
      if (supaErr.message === "DUPLICATE_EMAIL") {
        setDuplicateEmail(true)
      } else {
        setServerError(supaErr.message || "Registration failed. Please try again.")
      }
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

  if (duplicateEmail) {
    return (
      <AuthLayout heading="Account may exist" subheading="This email might already be registered">
        <div className="space-y-6 animate-fade-in">
          <div className="flex flex-col items-center text-center gap-4 py-4">
            <div className="h-16 w-16 rounded-md bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <Mail className="h-8 w-8 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground leading-relaxed">
                An account with <strong className="text-foreground">{form.email}</strong> may already exist.
              </p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Please try signing in instead, or use the "Forgot password" option if you can't remember your credentials.
              </p>
            </div>
          </div>
          <div className="space-y-3">
            <Link to="/login" className="block">
              <Button className="w-full h-11">
                Go to Sign In
              </Button>
            </Link>
            <Link to="/forgot-password" className="block">
              <Button variant="outline" className="w-full h-11">
                Forgot Password?
              </Button>
            </Link>
            <a href="mailto:support@bibleschool.com" className="block">
              <Button variant="ghost" className="w-full h-11 text-muted-foreground">
                Contact Support
              </Button>
            </a>
          </div>
        </div>
      </AuthLayout>
    )
  }

  if (success) {
    const isTeacher = form.role === "teacher"
    return (
      <AuthLayout
        heading={isTeacher ? "Application submitted" : "Check your email"}
        subheading={isTeacher ? "One more step before you can start teaching" : "Almost there — just one more step"}
      >
        <div className="space-y-6 animate-fade-in">
          <div className="flex flex-col items-center text-center gap-4 py-4">
            <div className={`h-16 w-16 rounded-md flex items-center justify-center ${
              isTeacher
                ? "bg-amber-100 dark:bg-amber-900/30"
                : "bg-primary/10"
            }`}>
              {isTeacher ? (
                <Clock className="h-8 w-8 text-amber-600 dark:text-amber-400" />
              ) : (
                <MailCheck className="h-8 w-8 text-primary" />
              )}
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground leading-relaxed">
                We sent a confirmation link to <strong className="text-foreground">{form.email}</strong>.
                <br />Click the link in the email to activate your account.
              </p>
              {isTeacher && (
                <div className="mt-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                  <p className="text-sm text-amber-800 dark:text-amber-300 leading-relaxed">
                    After confirming your email, your teacher account will need to be approved by an administrator.
                    You'll be able to log in, but course creation tools will be available once approved.
                  </p>
                </div>
              )}
            </div>
          </div>
          <Link to="/login" className="block">
            <Button variant="outline" className="w-full h-11">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Sign In
            </Button>
          </Link>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout heading="Create an account" subheading="Choose your role and start learning today">
      <div className="space-y-6 animate-fade-in">
        {serverError && (
          <div role="alert" className="text-sm text-destructive bg-destructive/10 border border-destructive/20 p-3 rounded-lg">
            {serverError}
          </div>
        )}

        <Button
          type="button"
          variant="outline"
          className="w-full h-11 font-medium rounded-md"
          onClick={handleGoogleSignUp}
        >
          <GoogleIcon className="h-4 w-4 mr-2.5" />
          Continue with Google
        </Button>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-3 text-muted-foreground">or register with email</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Role selector */}
          <div className="space-y-2">
            <Label>I am a</Label>
            <div role="radiogroup" aria-label="Account type" className="grid grid-cols-2 gap-3">
              {roles.map((r) => {
                const Icon = r.icon
                const selected = form.role === r.value
                return (
                  <button
                    key={r.value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => handleChange("role", r.value)}
                    className={`relative flex flex-col items-center gap-1.5 rounded-md border-2 p-4 transition-all duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                      selected
                        ? "border-primary bg-primary/5 shadow-sm"
                        : "border-border hover:border-muted-foreground/30 hover:bg-muted/50"
                    }`}
                  >
                    <Icon className={`h-6 w-6 transition-colors ${selected ? "text-primary" : "text-muted-foreground"}`} />
                    <span className={`text-sm font-medium transition-colors ${selected ? "text-primary" : ""}`}>
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
              autoComplete="name"
              className="h-11"
              value={form.full_name}
              onChange={(e) => handleChange("full_name", e.target.value)}
              aria-invalid={!!errors.full_name}
              aria-describedby={errors.full_name ? "fullName-error" : undefined}
            />
            {errors.full_name && <p id="fullName-error" role="alert" className="text-xs text-destructive mt-1">{errors.full_name}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              autoComplete="email"
              className="h-11"
              value={form.email}
              onChange={(e) => handleChange("email", e.target.value)}
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? "reg-email-error" : undefined}
            />
            {errors.email && <p id="reg-email-error" role="alert" className="text-xs text-destructive mt-1">{errors.email}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                className="h-11"
                value={form.password}
                onChange={(e) => handleChange("password", e.target.value)}
                aria-invalid={!!errors.password}
                aria-describedby={errors.password ? "reg-password-error" : undefined}
              />
              {errors.password && <p id="reg-password-error" role="alert" className="text-xs text-destructive mt-1">{errors.password}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm</Label>
              <Input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                className="h-11"
                value={form.confirmPassword}
                onChange={(e) => handleChange("confirmPassword", e.target.value)}
                aria-invalid={!!errors.confirmPassword}
                aria-describedby={errors.confirmPassword ? "confirmPassword-error" : undefined}
              />
              {errors.confirmPassword && (
                <p id="confirmPassword-error" role="alert" className="text-xs text-destructive mt-1">{errors.confirmPassword}</p>
              )}
            </div>
          </div>

          <Button type="submit" className="w-full h-11 font-medium rounded-md" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating account...
              </>
            ) : (
              "Create Account"
            )}
          </Button>
        </form>

        <p className="text-sm text-center text-muted-foreground">
          Already have an account?{" "}
          <Link to="/login" className="text-primary font-medium hover:text-primary/80 transition-colors">
            Sign in
          </Link>
        </p>
      </div>
    </AuthLayout>
  )
}
