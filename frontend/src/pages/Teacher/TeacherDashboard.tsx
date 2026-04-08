import { useEffect, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { coursesService } from "@/services/courses"
import { courseSchema, type CourseFormData } from "@/lib/validations/course"
import type { Course, Certificate } from "@/types"
import { toast } from "@/hooks/use-toast"
import { Plus, Pencil, Trash2, BookOpen, Layers, BarChart3, Eye, EyeOff, ClipboardList, Users, Clock, CheckCircle, XCircle, Award, Search, Copy, RotateCcw, Archive } from "lucide-react"
import { getErrorDetail } from "@/lib/errorDetail"

export default function TeacherDashboard() {
  const navigate = useNavigate()
  const [courses, setCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState<CourseFormData>({ title: "", description: "", image_url: "" })
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({})
  const [saving, setSaving] = useState(false)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [cloningId, setCloningId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [trashedCourses, setTrashedCourses] = useState<Course[]>([])
  const [showTrash, setShowTrash] = useState(false)
  const [trashLoading, setTrashLoading] = useState(false)
  const [restoringId, setRestoringId] = useState<string | null>(null)
  const [pendingCerts, setPendingCerts] = useState<(Certificate & { student_name?: string; course_title?: string })[]>([])
  const [certActionId, setCertActionId] = useState<string | null>(null)

  const handleApproveCert = async (certId: string) => {
    setCertActionId(certId)
    try {
      await coursesService.teacherApproveCert(certId)
      setPendingCerts((prev) => prev.filter((c) => c.id !== certId))
      toast({ title: "Certificate approved", variant: "success" })
    } catch (err) {
      toast({ title: getErrorDetail(err, "Failed to approve certificate"), variant: "destructive" })
    } finally {
      setCertActionId(null)
    }
  }

  const handleRejectCert = async (certId: string) => {
    setCertActionId(certId)
    try {
      await coursesService.rejectCert(certId)
      setPendingCerts((prev) => prev.filter((c) => c.id !== certId))
      toast({ title: "Certificate request declined" })
    } catch (err) {
      toast({ title: getErrorDetail(err, "Failed to reject certificate"), variant: "destructive" })
    } finally {
      setCertActionId(null)
    }
  }

  const handleToggleStatus = async (course: Course) => {
    const newStatus = course.status === "published" ? "draft" : "published"
    setTogglingId(course.id)
    try {
      await coursesService.updateCourse(course.id, { status: newStatus })
      setCourses((prev) =>
        prev.map((c) => (c.id === course.id ? { ...c, status: newStatus } : c)),
      )
      toast({ title: `Course ${newStatus === "published" ? "published" : "unpublished"}`, variant: "success" })
    } catch (err) {
      toast({ title: getErrorDetail(err, "Failed to update status"), variant: "destructive" })
    } finally {
      setTogglingId(null)
    }
  }

  const load = async (signal?: { cancelled: boolean }) => {
    setLoading(true)
    setError(null)
    try {
      const [data, certs] = await Promise.all([
        coursesService.getTeacherCourses(),
        coursesService.getPendingCertificates().catch(() => []),
      ])
      if (signal?.cancelled) return
      setCourses(data)
      setPendingCerts(certs)
    } catch {
      if (!signal?.cancelled) setError("Failed to load your courses. Please try again.")
    } finally {
      if (!signal?.cancelled) setLoading(false)
    }
  }

  useEffect(() => {
    const signal = { cancelled: false }
    load(signal)
    return () => { signal.cancelled = true }
  }, [])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    const result = courseSchema.safeParse(form)
    if (!result.success) {
      const fieldErrors: typeof errors = {}
      for (const issue of result.error.issues) {
        const key = String(issue.path[0])
        if (!fieldErrors[key]) fieldErrors[key] = issue.message
      }
      setErrors(fieldErrors)
      return
    }
    setSaving(true)
    try {
      const newCourse = await coursesService.createCourse({
        title: result.data.title,
        description: result.data.description || undefined,
        image_url: result.data.image_url || undefined,
      })
      setForm({ title: "", description: "", image_url: "" })
      setShowCreate(false)
      setErrors({})
      toast({ title: "Course created", variant: "success" })
      navigate(`/teacher/courses/${newCourse.id}`)
    } catch {
      toast({ title: "Failed to create course", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Move this course to trash? You can restore it later.")) return
    try {
      await coursesService.deleteCourse(id)
      setCourses((prev) => prev.filter((c) => c.id !== id))
      toast({ title: "Course moved to trash", variant: "success" })
    } catch (err) {
      toast({ title: getErrorDetail(err, "Failed to delete course"), variant: "destructive" })
    }
  }

  const loadTrash = async () => {
    setTrashLoading(true)
    try {
      const data = await coursesService.getTrashedCourses()
      setTrashedCourses(data)
    } catch {
      toast({ title: "Failed to load trash", variant: "destructive" })
    } finally {
      setTrashLoading(false)
    }
  }

  const handleRestore = async (id: string) => {
    setRestoringId(id)
    try {
      const restored = await coursesService.restoreCourse(id)
      setTrashedCourses((prev) => prev.filter((c) => c.id !== id))
      setCourses((prev) => [restored, ...prev])
      toast({ title: "Course restored", variant: "success" })
    } catch (err) {
      toast({ title: getErrorDetail(err, "Failed to restore course"), variant: "destructive" })
    } finally {
      setRestoringId(null)
    }
  }

  const handlePermanentDelete = async (id: string) => {
    if (!confirm("This will PERMANENTLY delete this course and all its data. This action cannot be undone.\n\nAre you sure?")) return
    try {
      await coursesService.permanentlyDeleteCourse(id)
      setTrashedCourses((prev) => prev.filter((c) => c.id !== id))
      toast({ title: "Course permanently deleted" })
    } catch (err) {
      toast({ title: getErrorDetail(err, "Failed to delete course"), variant: "destructive" })
    }
  }

  const handleClone = async (id: string) => {
    setCloningId(id)
    try {
      const cloned = await coursesService.cloneCourse(id)
      toast({ title: "Course cloned successfully", variant: "success" })
      navigate(`/teacher/courses/${cloned.id}`)
    } catch (err) {
      toast({ title: getErrorDetail(err, "Failed to clone course"), variant: "destructive" })
    } finally {
      setCloningId(null)
    }
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My Courses</h1>
          <p className="text-muted-foreground mt-1">Create and manage your course content</p>
        </div>
        <Button onClick={() => setShowCreate(!showCreate)} size="sm">
          <Plus className="h-4 w-4 mr-1.5" />
          New Course
        </Button>
      </div>

      {showCreate && (
        <Card className="mb-8 border-dashed">
          <CardHeader>
            <CardTitle className="text-lg">Create New Course</CardTitle>
          </CardHeader>
          <form onSubmit={handleCreate}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={form.title}
                  onChange={(e) => {
                    setForm((p) => ({ ...p, title: e.target.value }))
                    setErrors((p) => ({ ...p, title: undefined }))
                  }}
                  placeholder="Introduction to Theology"
                />
                {errors.title && <p className="text-sm text-destructive">{errors.title}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="desc">Description</Label>
                <textarea
                  id="desc"
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={form.description}
                  onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                  placeholder="A brief description of the course..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="img">Cover Image URL (optional — or upload after creating)</Label>
                <Input
                  id="img"
                  value={form.image_url}
                  onChange={(e) => setForm((p) => ({ ...p, image_url: e.target.value }))}
                  placeholder="https://... (you can upload in the editor)"
                />
                {errors.image_url && <p className="text-sm text-destructive">{errors.image_url}</p>}
              </div>
              <div className="flex gap-2 pt-2">
                <Button type="submit" disabled={saving}>
                  {saving ? "Creating..." : "Create Course"}
                </Button>
                <Button type="button" variant="ghost" onClick={() => setShowCreate(false)}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </form>
        </Card>
      )}

      {pendingCerts.length > 0 && (
        <Card className="mb-8 border-amber-200 dark:border-amber-800">
          <CardHeader>
            <CardTitle className="text-xl flex items-center gap-2">
              <Award className="h-5 w-5 text-amber-600" />
              Pending Certificates
              <span className="text-sm font-normal bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 rounded-full px-2.5 py-0.5">
                {pendingCerts.length}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {pendingCerts.map((cert) => (
                <div
                  key={cert.id}
                  className="flex items-center justify-between p-4 rounded-lg border bg-amber-50/50 dark:bg-amber-950/20"
                >
                  <div className="min-w-0">
                    <p className="font-medium truncate">{cert.student_name || "Student"}</p>
                    <p className="text-sm text-muted-foreground truncate">{cert.course_title || "Course"}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <Clock className="h-3 w-3" />
                      Requested {cert.requested_at ? new Date(cert.requested_at).toLocaleDateString() : "Unknown"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-4">
                    <Button
                      size="sm"
                      onClick={() => handleApproveCert(cert.id)}
                      disabled={certActionId === cert.id}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      <CheckCircle className="h-4 w-4 mr-1.5" />
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleRejectCert(cert.id)}
                      disabled={certActionId === cert.id}
                      className="text-destructive hover:text-destructive"
                    >
                      <XCircle className="h-4 w-4 mr-1.5" />
                      Reject
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : error ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <BookOpen className="h-12 w-12 text-destructive/40 mb-4" />
            <h3 className="text-lg font-medium mb-1">Something went wrong</h3>
            <p className="text-sm text-muted-foreground mb-4">{error}</p>
            <Button onClick={() => load()} size="sm" variant="outline">
              Try again
            </Button>
          </CardContent>
        </Card>
      ) : courses.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <BookOpen className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium mb-1">No courses yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Create your first course to start teaching
            </p>
            <Button onClick={() => setShowCreate(true)} size="sm">
              <Plus className="h-4 w-4 mr-1.5" />
              Create Course
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {courses.length > 3 && (
            <div className="mb-4 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search courses..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="max-w-sm pl-9"
              />
            </div>
          )}
          <div className="space-y-4">
          {courses
            .filter(c => !search.trim() || c.title.toLowerCase().includes(search.toLowerCase()))
            .map((course) => (
            <Card key={course.id} className="group hover:shadow-md transition-shadow">
              <div className="flex items-start gap-4 p-6">
                {course.image_url ? (
                  <img
                    src={course.image_url}
                    alt={`${course.title} thumbnail`}
                    loading="lazy"
                    className="w-20 h-20 rounded-lg object-cover shrink-0"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    <BookOpen className="h-8 w-8 text-muted-foreground/40" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-lg truncate">{course.title}</h3>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        course.status === "published"
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                          : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                      }`}
                    >
                      {course.status === "published" ? "Published" : "Draft"}
                    </span>
                  </div>
                  {course.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                      {course.description}
                    </p>
                  )}
                  <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Layers className="h-3.5 w-3.5" />
                      {course.modules?.length ?? 0} modules
                    </span>
                    <span>
                      Created {new Date(course.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Link to={`/teacher/courses/${course.id}/analytics`}>
                    <Button variant="ghost" size="sm" title="Analytics">
                      <BarChart3 className="h-4 w-4" />
                      <span className="sr-only">Analytics</span>
                    </Button>
                  </Link>
                  <Link to={`/teacher/courses/${course.id}/gradebook`}>
                    <Button variant="ghost" size="sm" title="Gradebook">
                      <ClipboardList className="h-4 w-4" />
                      <span className="sr-only">Gradebook</span>
                    </Button>
                  </Link>
                  <Link to={`/teacher/courses/${course.id}/progress`}>
                    <Button variant="ghost" size="sm" title="Student Progress">
                      <Users className="h-4 w-4" />
                      <span className="sr-only">Progress</span>
                    </Button>
                  </Link>
                  <Button
                    variant="ghost"
                    size="sm"
                    title={course.status === "published" ? "Unpublish" : "Publish"}
                    disabled={togglingId === course.id}
                    onClick={() => handleToggleStatus(course)}
                  >
                    {course.status === "published" ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                    <span className="sr-only">{course.status === "published" ? "Unpublish" : "Publish"}</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    title="Clone course"
                    disabled={cloningId === course.id}
                    onClick={() => handleClone(course.id)}
                  >
                    {cloningId === course.id ? (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                    <span className="sr-only">Clone</span>
                  </Button>
                  <Link to={`/teacher/courses/${course.id}`}>
                    <Button variant="ghost" size="sm" aria-label="Edit course">
                      <Pencil className="h-4 w-4" />
                      <span className="hidden sm:inline">Edit</span>
                    </Button>
                  </Link>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDelete(course.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
        </>
      )}

      {/* Trash Section */}
      <div className="mt-12 border-t pt-8">
        <button
          onClick={() => { const willShow = !showTrash; setShowTrash(willShow); if (willShow) loadTrash() }}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <Archive className="h-4 w-4" />
          {showTrash ? "Hide Trash" : "Show Trash"}
        </button>

        {showTrash && (
          <div className="mt-4">
            {trashLoading ? (
              <div className="flex justify-center py-8">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            ) : trashedCourses.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">Trash is empty.</p>
            ) : (
              <div className="space-y-3">
                {trashedCourses.map((course) => (
                  <Card key={course.id} className="opacity-70 border-dashed">
                    <div className="flex items-center gap-4 p-4">
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-medium truncate">{course.title}</h4>
                        {course.deleted_at && (
                          <p className="text-xs text-muted-foreground">
                            Deleted {new Date(course.deleted_at).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRestore(course.id)}
                          disabled={restoringId === course.id}
                        >
                          <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                          Restore
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handlePermanentDelete(course.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                          Delete Forever
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
