import { useState } from "react"
import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { useAuth } from "@/context/AuthContext"
import { ArrowLeft } from "lucide-react"

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
      <div className="flex items-center justify-center min-h-[calc(100vh-7rem)] px-4">
        <Card className="w-full max-w-md shadow-lg animate-fade-in">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl tracking-tight">Check Your Email</CardTitle>
            <CardDescription className="mt-2">
              If an account exists for <strong>{email}</strong>, we sent a password reset link.
              Please check your inbox.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Link to="/login" className="w-full">
              <Button variant="outline" className="w-full">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Sign In
              </Button>
            </Link>
          </CardFooter>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-7rem)] px-4">
      <Card className="w-full max-w-md shadow-lg animate-fade-in">
        <CardHeader className="text-center pb-2">
          <CardTitle className="text-2xl tracking-tight">Reset Password</CardTitle>
          <CardDescription>Enter your email and we'll send you a reset link</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4 pt-4">
            {error && (
              <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Sending..." : "Send Reset Link"}
            </Button>
            <Link
              to="/login"
              className="text-xs text-center text-muted-foreground hover:text-primary transition-colors"
            >
              <ArrowLeft className="h-3 w-3 inline mr-1" />
              Back to Sign In
            </Link>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
