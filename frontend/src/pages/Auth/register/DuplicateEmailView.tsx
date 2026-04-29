import { Link } from "react-router-dom"
import { Mail } from "lucide-react"
import { Button } from "@/components/ui/button"
import AuthLayout from "@/components/layout/AuthLayout"

/**
 * Terminal state shown when the register endpoint reports a duplicate
 * email. We can't tell whether it was a typo or a genuine prior
 * registration, so surface all three recovery paths (login, reset, support)
 * instead of forcing one.
 */
export function DuplicateEmailView({ email }: { email: string }) {
  return (
    <AuthLayout
      heading="Account may exist"
      subheading="This email might already be registered"
    >
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col items-center text-center gap-4 py-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-md bg-warning/10">
            <Mail className="h-8 w-8 text-warning" />
          </div>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground leading-relaxed">
              An account with <strong className="text-foreground">{email}</strong> may already exist.
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Please try signing in instead, or use the "Forgot password" option if you can't
              remember your credentials.
            </p>
          </div>
        </div>
        <div className="space-y-3">
          <Link to="/login" className="block">
            <Button size="lg" className="w-full">
              Go to Sign In
            </Button>
          </Link>
          <Link to="/forgot-password" className="block">
            <Button variant="outline" size="lg" className="w-full">
              Forgot Password?
            </Button>
          </Link>
          <a href="mailto:support@bibleschool.com" className="block">
            <Button variant="ghost" size="lg" className="w-full text-muted-foreground">
              Contact Support
            </Button>
          </a>
        </div>
      </div>
    </AuthLayout>
  )
}
