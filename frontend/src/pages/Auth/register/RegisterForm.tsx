import { Link } from "react-router-dom"
import { BookOpenCheck, GraduationCap, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import AuthLayout from "@/components/layout/AuthLayout"
import { GoogleIcon } from "./GoogleIcon"
import type { FormState } from "./useRegister"

const ROLES = [
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

interface Props {
  form: FormState
  errors: Partial<Record<string, string>>
  serverError: string
  loading: boolean
  googleLoading: boolean
  onChange: (field: keyof FormState, value: string) => void
  onSubmit: () => void
  onGoogleSignUp: () => void
}

/**
 * The actual registration form — role toggle, four text inputs,
 * Google OAuth shortcut, submit button. Receives state and handlers from
 * `useRegister`; nothing in here owns mutable state.
 */
export function RegisterForm({
  form,
  errors,
  serverError,
  loading,
  googleLoading,
  onChange,
  onSubmit,
  onGoogleSignUp,
}: Props) {
  return (
    <AuthLayout
      heading="Create an account"
      subheading="Choose your role and start learning today"
    >
      <div className="space-y-6 animate-fade-in">
        {serverError && (
          <div
            role="alert"
            className="text-sm text-destructive bg-destructive/10 border border-destructive/20 p-3 rounded-lg"
          >
            {serverError}
          </div>
        )}

        <Button
          type="button"
          variant="outline"
          size="lg"
          className="w-full font-medium rounded-md"
          onClick={onGoogleSignUp}
          disabled={googleLoading || loading}
        >
          {googleLoading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Connecting...
            </>
          ) : (
            <>
              <GoogleIcon className="h-4 w-4 mr-2.5" />
              Continue with Google
            </>
          )}
        </Button>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-3 text-muted-foreground">
              or register with email
            </span>
          </div>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            onSubmit()
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label>I am a</Label>
            <div
              role="radiogroup"
              aria-label="Account type"
              className="grid grid-cols-2 gap-3"
            >
              {ROLES.map((r) => {
                const Icon = r.icon
                const selected = form.role === r.value
                return (
                  <button
                    key={r.value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => onChange("role", r.value)}
                    className={`relative flex flex-col items-center gap-1.5 rounded-md border-2 p-4 transition-all duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                      selected
                        ? "border-primary bg-primary/5 shadow-sm"
                        : "border-border hover:border-muted-foreground/30 hover:bg-muted/50"
                    }`}
                  >
                    <Icon
                      className={`h-6 w-6 transition-colors ${
                        selected ? "text-primary" : "text-muted-foreground"
                      }`}
                    />
                    <span
                      className={`text-sm font-medium transition-colors ${
                        selected ? "text-primary" : ""
                      }`}
                    >
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
              fieldSize="lg"
              value={form.full_name}
              onChange={(e) => onChange("full_name", e.target.value)}
              aria-invalid={!!errors.full_name}
              aria-describedby={errors.full_name ? "fullName-error" : undefined}
              autoFocus
            />
            {errors.full_name && (
              <p
                id="fullName-error"
                role="alert"
                className="text-xs text-destructive mt-1"
              >
                {errors.full_name}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              autoComplete="email"
              fieldSize="lg"
              value={form.email}
              onChange={(e) => onChange("email", e.target.value)}
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? "reg-email-error" : undefined}
            />
            {errors.email && (
              <p
                id="reg-email-error"
                role="alert"
                className="text-xs text-destructive mt-1"
              >
                {errors.email}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                fieldSize="lg"
                value={form.password}
                onChange={(e) => onChange("password", e.target.value)}
                aria-invalid={!!errors.password}
                aria-describedby={errors.password ? "reg-password-error" : undefined}
              />
              {errors.password && (
                <p
                  id="reg-password-error"
                  role="alert"
                  className="text-xs text-destructive mt-1"
                >
                  {errors.password}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm</Label>
              <Input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                fieldSize="lg"
                value={form.confirmPassword}
                onChange={(e) => onChange("confirmPassword", e.target.value)}
                aria-invalid={!!errors.confirmPassword}
                aria-describedby={
                  errors.confirmPassword ? "confirmPassword-error" : undefined
                }
              />
              {errors.confirmPassword && (
                <p
                  id="confirmPassword-error"
                  role="alert"
                  className="text-xs text-destructive mt-1"
                >
                  {errors.confirmPassword}
                </p>
              )}
            </div>
          </div>

          <Button
            type="submit"
            size="lg"
            className="w-full font-medium rounded-md"
            disabled={loading}
          >
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
          <Link
            to="/login"
            className="text-primary font-medium hover:text-primary/80 transition-colors"
          >
            Sign in
          </Link>
        </p>
      </div>
    </AuthLayout>
  )
}
