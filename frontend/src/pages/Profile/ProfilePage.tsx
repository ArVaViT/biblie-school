import { useState, useRef, useEffect } from "react"
import { Link, useNavigate } from "react-router-dom"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useAuth } from "@/context/useAuth"
import { useTheme } from "@/context/useTheme"
import { usersService } from "@/services/users"
import { storageService } from "@/services/storage"
import { coursesService } from "@/services/courses"
import { profileSchema } from "@/lib/validations/course"
import {
  User as UserIcon, Mail, Shield, Calendar, Save, Check, Camera,
  Loader2, Award, BookOpen, ArrowRight, LogOut, Moon, Sun,
  Download, AlertTriangle, Trash2,
} from "lucide-react"

export default function ProfilePage() {
  const { user, refreshUser, logout } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const [name, setName] = useState(user?.full_name ?? "")

  useEffect(() => {
    if (user?.full_name !== undefined) setName(user.full_name ?? "")
  }, [user?.full_name])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState("")
  const [uploading, setUploading] = useState(false)
  const [certificateCount, setCertificateCount] = useState(0)
  const [completedCount, setCompletedCount] = useState(0)
  const fileRef = useRef<HTMLInputElement>(null)

  const [exporting, setExporting] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState("")
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState("")

  useEffect(() => {
    const loadStats = async () => {
      try {
        const [certs, enrollments] = await Promise.all([
          coursesService.getMyCertificates().catch(() => []),
          coursesService.getMyCourses().catch(() => []),
        ])
        setCertificateCount(certs.length)
        setCompletedCount(enrollments.filter((e) => e.progress >= 100).length)
      } catch { /* non-critical */ }
    }
    loadStats()
  }, [])

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

  const handleExportData = async () => {
    setExporting(true)
    try {
      const data = await usersService.exportMyData()
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `my-data-export-${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch {
      setError("Failed to export data. Please try again.")
    } finally {
      setExporting(false)
    }
  }

  const handleDeleteAccount = async () => {
    if (deleteConfirm !== "DELETE") return
    setDeleting(true)
    setDeleteError("")
    try {
      await usersService.deleteMyAccount()
      setDeleteOpen(false)
      logout()
      navigate("/login", { replace: true })
    } catch {
      setDeleteError("Failed to delete account. Please try again or contact support.")
    } finally {
      setDeleting(false)
    }
  }

  const handleLogout = () => {
    logout()
    navigate("/login", { replace: true })
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
            <CardTitle className="text-base">Learning Progress</CardTitle>
            <CardDescription>Your achievements at a glance</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-3 rounded-lg border p-3">
                <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-emerald-50 dark:bg-emerald-950/30">
                  <BookOpen className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold leading-none">{completedCount}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Courses Completed</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-lg border p-3">
                <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-amber-50 dark:bg-amber-950/30">
                  <Award className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold leading-none">{certificateCount}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Certificates Earned</p>
                </div>
              </div>
            </div>
            {certificateCount > 0 && (
              <Link to="/certificates" className="mt-4 inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
                View all certificates
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            )}
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

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Preferences</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {theme === "dark" ? <Moon className="h-4 w-4 text-muted-foreground" /> : <Sun className="h-4 w-4 text-muted-foreground" />}
                <div>
                  <p className="text-sm font-medium">Theme</p>
                  <p className="text-xs text-muted-foreground">{theme === "dark" ? "Dark mode" : "Light mode"}</p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={toggleTheme}>
                {theme === "dark" ? <Sun className="h-3.5 w-3.5 mr-1.5" /> : <Moon className="h-3.5 w-3.5 mr-1.5" />}
                {theme === "dark" ? "Light" : "Dark"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Your Data</CardTitle>
            <CardDescription>Download a copy of all your data stored on this platform</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={handleExportData} disabled={exporting}>
              {exporting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              {exporting ? "Preparing export..." : "Export My Data"}
            </Button>
          </CardContent>
        </Card>

        <Button variant="destructive" className="w-full" onClick={handleLogout}>
          <LogOut className="h-4 w-4 mr-2" />
          Sign Out
        </Button>

        <Card className="border-destructive/50">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <CardTitle className="text-base text-destructive">Danger Zone</CardTitle>
            </div>
            <CardDescription>
              Permanently delete your account and all associated data. This action cannot be undone.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Deleting your account will remove your profile, enrollments, quiz attempts,
              assignment submissions, grades, certificates, notes, reviews, and notifications.
              Courses you created will be preserved but disassociated from your account.
            </p>
            <Button
              variant="destructive"
              onClick={() => {
                setDeleteConfirm("")
                setDeleteError("")
                setDeleteOpen(true)
              }}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete My Account
            </Button>
          </CardContent>
        </Card>
      </div>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Delete Account
            </DialogTitle>
            <DialogDescription>
              This will permanently delete your account and all your data.
              This action is irreversible.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <p className="text-sm">
              To confirm, type <span className="font-mono font-bold">DELETE</span> in the box below:
            </p>
            <Input
              value={deleteConfirm}
              onChange={(e) => {
                setDeleteConfirm(e.target.value)
                setDeleteError("")
              }}
              placeholder="Type DELETE to confirm"
              autoComplete="off"
            />
            {deleteError && (
              <p className="text-sm text-destructive">{deleteError}</p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteAccount}
              disabled={deleteConfirm !== "DELETE" || deleting}
            >
              {deleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Permanently Delete"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
