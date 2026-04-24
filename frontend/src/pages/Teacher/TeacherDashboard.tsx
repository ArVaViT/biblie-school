import { useEffect, useMemo, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { BookOpen, Plus, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import PageSpinner from "@/components/ui/PageSpinner"
import { useConfirm } from "@/components/ui/alert-dialog"
import { useDebouncedSearchParam } from "@/hooks/useDebouncedSearchParam"
import { courseSchema, type CourseFormData } from "@/lib/validations/course"
import { getErrorDetail } from "@/lib/errorDetail"
import { coursesService } from "@/services/courses"
import { toast } from "@/lib/toast"
import type { Course } from "@/types"
import {
  CourseCard,
  CreateCourseForm,
  EmptyCoursesCard,
  PendingCertsCard,
  TrashSection,
  type PendingCert,
} from "./dashboard"

export default function TeacherDashboard() {
  const navigate = useNavigate()
  const confirm = useConfirm()
  const [params, setParams] = useSearchParams()
  const showTrash = params.get("trash") === "1"
  const {
    input: searchInput,
    setInput: setSearchInput,
    value: urlQuery,
    maxLength: MAX_SEARCH_LEN,
  } = useDebouncedSearchParam()
  const [courses, setCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState<CourseFormData>({
    title: "",
    description: "",
    image_url: "",
  })
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({})
  const [saving, setSaving] = useState(false)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [cloningId, setCloningId] = useState<string | null>(null)
  const [pendingCerts, setPendingCerts] = useState<PendingCert[]>([])
  const [certActionId, setCertActionId] = useState<string | null>(null)

  const filteredCourses = useMemo(() => {
    const q = urlQuery.trim().toLowerCase()
    if (!q) return courses
    return courses.filter((c) => c.title.toLowerCase().includes(q))
  }, [courses, urlQuery])

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
      if (!signal?.cancelled)
        setError("Failed to load your courses. Please try again.")
    } finally {
      if (!signal?.cancelled) setLoading(false)
    }
  }

  useEffect(() => {
    const signal = { cancelled: false }
    void load(signal)
    return () => {
      signal.cancelled = true
    }
  }, [])

  const handleApproveCert = async (certId: string) => {
    setCertActionId(certId)
    try {
      await coursesService.teacherApproveCert(certId)
      setPendingCerts((prev) => prev.filter((c) => c.id !== certId))
      toast({ title: "Certificate approved", variant: "success" })
    } catch (err) {
      toast({
        title: getErrorDetail(err, "Failed to approve certificate"),
        variant: "destructive",
      })
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
      toast({
        title: getErrorDetail(err, "Failed to reject certificate"),
        variant: "destructive",
      })
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
      toast({
        title: `Course ${newStatus === "published" ? "published" : "unpublished"}`,
        variant: "success",
      })
    } catch (err) {
      toast({
        title: getErrorDetail(err, "Failed to update status"),
        variant: "destructive",
      })
    } finally {
      setTogglingId(null)
    }
  }

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
    const ok = await confirm({
      title: "Move course to trash?",
      description: "You can restore it from trash later.",
      confirmLabel: "Move to trash",
      tone: "destructive",
    })
    if (!ok) return
    try {
      await coursesService.deleteCourse(id)
      setCourses((prev) => prev.filter((c) => c.id !== id))
      toast({ title: "Course moved to trash", variant: "success" })
    } catch (err) {
      toast({
        title: getErrorDetail(err, "Failed to delete course"),
        variant: "destructive",
      })
    }
  }

  const handleClone = async (id: string) => {
    setCloningId(id)
    try {
      const cloned = await coursesService.cloneCourse(id)
      toast({ title: "Course cloned successfully", variant: "success" })
      navigate(`/teacher/courses/${cloned.id}`)
    } catch (err) {
      toast({
        title: getErrorDetail(err, "Failed to clone course"),
        variant: "destructive",
      })
    } finally {
      setCloningId(null)
    }
  }

  const toggleTrash = () => {
    const next = new URLSearchParams(params)
    if (showTrash) next.delete("trash")
    else next.set("trash", "1")
    setParams(next, { replace: true })
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My Courses</h1>
          <p className="text-muted-foreground mt-1">
            Create and manage your course content
          </p>
        </div>
        <Button onClick={() => setShowCreate(!showCreate)} size="sm">
          <Plus className="h-4 w-4 mr-1.5" />
          New Course
        </Button>
      </div>

      {showCreate && (
        <CreateCourseForm
          form={form}
          setForm={setForm}
          errors={errors}
          setErrors={setErrors}
          saving={saving}
          onSubmit={handleCreate}
          onCancel={() => setShowCreate(false)}
        />
      )}

      <PendingCertsCard
        certs={pendingCerts}
        actionId={certActionId}
        onApprove={handleApproveCert}
        onReject={handleRejectCert}
      />

      {loading ? (
        <PageSpinner />
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
        <EmptyCoursesCard onCreate={() => setShowCreate(true)} />
      ) : (
        <>
          {courses.length > 3 && (
            <div className="mb-4 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search courses..."
                value={searchInput}
                onChange={(e) =>
                  setSearchInput(e.target.value.slice(0, MAX_SEARCH_LEN))
                }
                maxLength={MAX_SEARCH_LEN}
                className="max-w-sm pl-9"
              />
            </div>
          )}
          <div className="space-y-4">
            {filteredCourses.map((course) => (
              <CourseCard
                key={course.id}
                course={course}
                togglingId={togglingId}
                cloningId={cloningId}
                onToggleStatus={handleToggleStatus}
                onClone={handleClone}
                onDelete={handleDelete}
              />
            ))}
          </div>
        </>
      )}

      <TrashSection
        visible={showTrash}
        onToggle={toggleTrash}
        onRestore={(restored) => setCourses((prev) => [restored, ...prev])}
      />
    </div>
  )
}
