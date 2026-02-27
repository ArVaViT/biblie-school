import { useState, useRef } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/context/AuthContext"
import { usersService } from "@/services/users"
import { storageService } from "@/services/storage"
import { profileSchema } from "@/lib/validations/course"
import { User as UserIcon, Mail, Shield, Calendar, Save, Check, Camera, Loader2 } from "lucide-react"

export default function ProfilePage() {
  const { user, refreshUser } = useAuth()
  const [name, setName] = useState(user?.full_name ?? "")
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState("")
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleSave = async () => {
    setError("")
    const result = profileSchema.safeParse({ full_name: name })
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? "Invalid input")
      return
    }
    setSaving(true)
    try {
      await usersService.updateProfile({ full_name: result.data.full_name })
      await refreshUser()
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch {
      setError("Failed to update profile")
    } finally {
      setSaving(false)
    }
  }

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user) return

    if (file.size > 2 * 1024 * 1024) {
      setError("Image must be under 2 MB")
      return
    }

    setUploading(true)
    setError("")
    try {
      const url = await storageService.uploadAvatar(user.id, file)
      await usersService.updateProfile({ avatar_url: url })
      await refreshUser()
    } catch {
      setError("Failed to upload avatar")
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ""
    }
  }

  if (!user) return null

  const initials = (user.full_name ?? user.email)
    .split(/[\s@]/)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("")

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <h1 className="text-3xl font-bold tracking-tight mb-8">Profile</h1>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className="relative group">
                {user.avatar_url ? (
                  <img
                    src={user.avatar_url}
                    alt={user.full_name ?? "Avatar"}
                    className="h-16 w-16 rounded-full object-cover border-2 border-background shadow-sm"
                  />
                ) : (
                  <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-lg">
                    {initials || <UserIcon className="h-7 w-7" />}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
                >
                  {uploading ? (
                    <Loader2 className="h-5 w-5 text-white animate-spin" />
                  ) : (
                    <Camera className="h-5 w-5 text-white" />
                  )}
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={handleAvatarChange}
                />
              </div>
              <div>
                <CardTitle>{user.full_name || "User"}</CardTitle>
                <CardDescription className="capitalize">{user.role}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <div className="flex gap-2">
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value)
                    setSaved(false)
                    setError("")
                  }}
                />
                <Button onClick={handleSave} disabled={saving || saved} size="sm" className="shrink-0">
                  {saved ? (
                    <>
                      <Check className="h-4 w-4 mr-1.5" />
                      Saved
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-1.5" />
                      {saving ? "Saving..." : "Save"}
                    </>
                  )}
                </Button>
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Account Details</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-4">
              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                <div>
                  <dt className="text-xs text-muted-foreground">Email</dt>
                  <dd className="text-sm font-medium">{user.email}</dd>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Shield className="h-4 w-4 text-muted-foreground shrink-0" />
                <div>
                  <dt className="text-xs text-muted-foreground">Role</dt>
                  <dd className="text-sm font-medium capitalize">{user.role}</dd>
                </div>
              </div>
              {user.created_at && (
                <div className="flex items-center gap-3">
                  <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div>
                    <dt className="text-xs text-muted-foreground">Member since</dt>
                    <dd className="text-sm font-medium">
                      {new Date(user.created_at).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </dd>
                  </div>
                </div>
              )}
            </dl>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
