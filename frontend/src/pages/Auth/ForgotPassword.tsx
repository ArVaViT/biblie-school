import { useState } from "react"
import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/context/useAuth"
import AuthLayout from "@/components/layout/AuthLayout"
import { ArrowLeft, Loader2, MailCheck } from "lucide-react"

export default function ForgotPassword() {
  const [email, setEmail] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const { resetPassword } = useAuth()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (!email.trim()) {
      setError("Please enter your email address")
      return
    }

    setLoading(true)
    try {
      await resetPassword(email)
      setSent(true)
    } catch (err: unknown) {
      const supaErr = err as { message?: string }
      setError(supaErr.message || "Failed to send reset email.")
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <AuthLayout heading="Check your email" subheading="We've sent you a password reset link">
        <div className="space-y-6 animate-fade-in">
          <div className="flex flex-col items-center text-center gap-4 py-4">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
              <MailCheck className="h-8 w-8 text-primary" />
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              If an account exists for <strong className="text-foreground">{email}</strong>,
              you'll receive a reset link shortly. Check your inbox.
            </p>
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
    <AuthLayout heading="Reset password" subheading="Enter your email and we'll send you a reset link">
      <div className="space-y-6 animate-fade-in">
        {error && (
          <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 p-3 rounded-lg">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email address</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              autoComplete="email"
              className="h-11"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus
            />
          </div>

          <Button type="submit" className="w-full h-11 font-medium" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              "Send Reset Link"
            )}
          </Button>
        </form>

        <Link
          to="/login"
          className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Sign In
        </Link>
      </div>
    </AuthLayout>
  )
}
