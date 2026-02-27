import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { coursesService } from "@/services/courses"
import { courseSchema, type CourseFormData } from "@/lib/validations/course"
import type { Course } from "@/types"
import { Plus, Pencil, Trash2, BookOpen, Layers, BarChart3, Eye, EyeOff } from "lucide-react"

export default function TeacherDashboard() {
  const [courses, setCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState<CourseFormData>({ title: "", description: "", image_url: "" })
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({})
  const [saving, setSaving] = useState(false)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  const handleToggleStatus = async (course: Course) => {
    const newStatus = course.status === "published" ? "draft" : "published"
    setTogglingId(course.id)
    try {
      await coursesService.updateCourse(course.id, { status: newStatus })
      setCourses((prev) =>
        prev.map((c) => (c.id === course.id ? { ...c, status: newStatus } : c)),
      )
    } catch (err) {
      console.error("Failed to update course status:", err)
    } finally {
      setTogglingId(null)
    }
  }

  const load = async () => {
    try {
      const data = await coursesService.getTeacherCourses()
      setCourses(data)
    } catch (err) {
      console.error("Failed to load courses:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
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
      await coursesService.createCourse({
        title: result.data.title,
        description: result.data.description || undefined,
        image_url: result.data.image_url || undefined,
      })
      setForm({ title: "", description: "", image_url: "" })
      setShowCreate(false)
      setErrors({})
      await load()
    } catch {
      setErrors({ title: "Failed to create course" })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this course and all its content?")) return
    try {
      await coursesService.deleteCourse(id)
      setCourses((prev) => prev.filter((c) => c.id !== id))
    } catch (err) {
      console.error("Failed to delete course:", err)
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

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
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
        <div className="space-y-4">
          {courses.map((course) => (
            <Card key={course.id} className="group hover:shadow-md transition-shadow">
              <div className="flex items-start gap-4 p-6">
                {course.image_url ? (
                  <img
                    src={course.image_url}
                    alt=""
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
                  </Button>
                  <Link to={`/teacher/courses/${course.id}`}>
                    <Button variant="ghost" size="sm" title="Edit">
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </Link>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(course.id)}
                    className="text-destructive hover:text-destructive"
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
