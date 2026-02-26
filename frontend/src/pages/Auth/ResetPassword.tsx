import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { authService } from "@/services/auth"
import { z } from "zod"

const resetSchema = z
  .object({
    password: z.string().min(6, "Password must be at least 6 characters"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  })

export default function ResetPassword() {
  const [form, setForm] = useState({ password: "", confirmPassword: "" })
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({})
  const [serverError, setServerError] = useState("")
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setServerError("")

    const result = resetSchema.safeParse(form)
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
      await authService.updatePassword(result.data.password)
      setSuccess(true)
      setTimeout(() => navigate("/dashboard", { replace: true }), 2000)
    } catch (err: unknown) {
      const supaErr = err as { message?: string }
      setServerError(supaErr.message || "Failed to reset password.")
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-7rem)] px-4">
        <Card className="w-full max-w-md shadow-lg animate-fade-in">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl tracking-tight">Password Updated</CardTitle>
            <CardDescription className="mt-2">
              Your password has been successfully updated. Redirecting to dashboard...
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-7rem)] px-4">
      <Card className="w-full max-w-md shadow-lg animate-fade-in">
        <CardHeader className="text-center pb-2">
          <CardTitle className="text-2xl tracking-tight">Set New Password</CardTitle>
          <CardDescription>Choose a strong password for your account</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4 pt-4">
            {serverError && (
              <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
                {serverError}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="password">New Password</Label>
              <Input
                id="password"
                type="password"
                value={form.password}
                onChange={(e) => {
                  setForm((prev) => ({ ...prev, password: e.target.value }))
                  setErrors((prev) => ({ ...prev, password: undefined }))
                }}
                aria-invalid={!!errors.password}
              />
              {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm New Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={form.confirmPassword}
                onChange={(e) => {
                  setForm((prev) => ({ ...prev, confirmPassword: e.target.value }))
                  setErrors((prev) => ({ ...prev, confirmPassword: undefined }))
                }}
                aria-invalid={!!errors.confirmPassword}
              />
              {errors.confirmPassword && (
                <p className="text-xs text-destructive">{errors.confirmPassword}</p>
              )}
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Updating..." : "Update Password"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
