import { useState, useRef, useEffect } from "react"
import { Link, useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import PageSpinner from "@/components/ui/PageSpinner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import LanguageSwitcher from "@/components/layout/LanguageSwitcher"
import { useAuth } from "@/context/useAuth"
import { useTheme } from "@/context/useTheme"
import { usersService } from "@/services/users"
import { storageService } from "@/services/storage"
import { coursesService } from "@/services/courses"
import { profileSchema } from "@/lib/validations/course"
import { toProxyImage } from "@/lib/images"
import type { User } from "@/types"
import {
  User as UserIcon, Mail, Shield, Calendar, Save, Check, Camera, Globe,
  Loader2, Award, BookOpen, ArrowRight, LogOut, Moon, Sun,
} from "lucide-react"

function NameForm({ user, onSaved }: { user: User; onSaved: () => Promise<void> }) {
  const { t } = useTranslation()
  const [name, setName] = useState(user.full_name ?? "")
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState("")
  const savedTimerRef = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => () => { clearTimeout(savedTimerRef.current) }, [])

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
      await onSaved()
      setName(result.data.full_name)
      setSaved(true)
      savedTimerRef.current = setTimeout(() => setSaved(false), 2000)
    } catch {
      setError(t("profile.updateFailed"))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-2">
      <Label htmlFor="name">{t("profile.fullName")}</Label>
      <div className="flex gap-2">
        <Input
          id="name"
          fieldSize="lg"
          value={name}
          onChange={(e) => {
            setName(e.target.value)
            setSaved(false)
            setError("")
          }}
          aria-invalid={!!error}
          aria-describedby={error ? "profile-name-error" : undefined}
        />
        <Button onClick={handleSave} disabled={saving || saved} size="lg" className="shrink-0">
          {saved ? (
            <>
              <Check className="h-4 w-4 mr-1.5" />
              {t("common.saved")}
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-1.5" />
              {saving ? t("common.saving") : t("common.save")}
            </>
          )}
        </Button>
      </div>
      {error && (
        <p id="profile-name-error" role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}

export default function ProfilePage() {
  const { user, refreshUser, logout } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [error, setError] = useState("")
  const [uploading, setUploading] = useState(false)
  const [certificateCount, setCertificateCount] = useState(0)
  const [completedCount, setCompletedCount] = useState(0)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!user?.id) return
    let cancelled = false
    const loadStats = async () => {
      try {
        const [certs, enrollments] = await Promise.all([
          coursesService.getMyCertificates().catch(() => []),
          coursesService.getMyCourses().catch(() => []),
        ])
        if (cancelled) return
        setCertificateCount(certs.length)
        setCompletedCount(enrollments.filter((e) => e.progress >= 100).length)
      } catch { /* non-critical */ }
    }
    loadStats()
    return () => { cancelled = true }
  }, [user?.id])

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user) return

    if (file.size > 2 * 1024 * 1024) {
      setError(t("profile.imageTooLarge"))
      return
    }

    setUploading(true)
    setError("")
    try {
      const url = await storageService.uploadAvatar(user.id, file)
      await usersService.updateProfile({ avatar_url: url })
      await refreshUser()
    } catch {
      setError(t("profile.uploadFailed"))
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ""
    }
  }

  const handleLogout = () => {
    logout()
    navigate("/login", { replace: true })
  }

  if (!user) {
    return <PageSpinner />
  }

  const initials = (user.full_name ?? user.email)
    .split(/[\s@]/)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("")

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <h1 className="text-3xl font-bold tracking-tight mb-8">{t("profile.title")}</h1>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className="relative group">
                {user.avatar_url ? (
                  <img
                    src={toProxyImage(user.avatar_url)}
                    alt={`${user.full_name ?? "User"} avatar`}
                    loading="lazy"
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
                  aria-label={t("profile.changeAvatar")}
                  className="absolute -bottom-0.5 -right-0.5 h-6 w-6 rounded-full bg-primary text-primary-foreground shadow-sm flex items-center justify-center cursor-pointer hover:bg-primary/90 transition-colors"
                >
                  {uploading ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Camera className="h-3 w-3" />
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
                <CardTitle>{user.full_name || t("header.profile")}</CardTitle>
                <CardDescription className="capitalize">{user.role}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <NameForm key={user.id} user={user} onSaved={refreshUser} />
            {error && <p className="text-sm text-destructive">{error}</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("profile.learningProgress")}</CardTitle>
            <CardDescription>{t("profile.learningProgressDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-3 rounded-md border border-border p-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-md bg-muted">
                  <BookOpen className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-2xl font-bold leading-none">{completedCount}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{t("profile.coursesCompleted")}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-md border border-border p-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-md bg-muted">
                  <Award className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-2xl font-bold leading-none">{certificateCount}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{t("profile.certificatesEarned")}</p>
                </div>
              </div>
            </div>
            {certificateCount > 0 && (
              <Link to="/certificates" className="mt-4 inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
                {t("profile.viewAllCertificates")}
                <ArrowRight className="h-4 w-4" strokeWidth={1.75} aria-hidden />
              </Link>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("profile.accountDetails")}</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-4">
              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                <div>
                  <dt className="text-xs text-muted-foreground">{t("auth.email")}</dt>
                  <dd className="text-sm font-medium">{user.email}</dd>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Shield className="h-4 w-4 text-muted-foreground shrink-0" />
                <div>
                  <dt className="text-xs text-muted-foreground">{t("profile.role")}</dt>
                  <dd className="text-sm font-medium capitalize">{user.role}</dd>
                </div>
              </div>
              {user.created_at && (
                <div className="flex items-center gap-3">
                  <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div>
                    <dt className="text-xs text-muted-foreground">{t("profile.memberSince")}</dt>
                    <dd className="text-sm font-medium">
                      {new Date(user.created_at).toLocaleDateString(user.preferred_locale === "en" ? "en-US" : "ru-RU", {
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
            <CardTitle className="text-base">{t("profile.preferences")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {theme === "dark" ? <Moon className="h-4 w-4 text-muted-foreground" /> : <Sun className="h-4 w-4 text-muted-foreground" />}
                <div>
                  <p className="text-sm font-medium">{t("profile.theme")}</p>
                  <p className="text-xs text-muted-foreground">{theme === "dark" ? t("profile.themeDark") : t("profile.themeLight")}</p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={toggleTheme}>
                {theme === "dark" ? (
                  <Sun className="mr-1.5 h-4 w-4" strokeWidth={1.75} aria-hidden />
                ) : (
                  <Moon className="mr-1.5 h-4 w-4" strokeWidth={1.75} aria-hidden />
                )}
                {theme === "dark" ? t("profile.switchToLight") : t("profile.switchToDark")}
              </Button>
            </div>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Globe className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">{t("language.label")}</p>
                  <p className="text-xs text-muted-foreground">
                    {user.preferred_locale === "en" ? t("language.english") : t("language.russian")}
                  </p>
                </div>
              </div>
              <LanguageSwitcher />
            </div>
          </CardContent>
        </Card>

        <Button variant="destructive" className="w-full" onClick={handleLogout}>
          <LogOut className="h-4 w-4 mr-2" />
          {t("common.signOut")}
        </Button>
      </div>
    </div>
  )
}
