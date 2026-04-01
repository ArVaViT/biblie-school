import { useEffect, useState, useCallback } from "react"
import { useParams, Link } from "react-router-dom"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { coursesService } from "@/services/courses"
import { storageService } from "@/services/storage"
import { useAuth } from "@/context/useAuth"
import type { Course, Enrollment, Certificate, Cohort, CalendarEvent } from "@/types"
import { toast } from "@/hooks/use-toast"
import {
  BookOpen, ArrowRight, CheckCircle, Users, Layers, ArrowLeft,
  CalendarDays, Clock, Lock, Download, Paperclip, Star, X, AlertTriangle,
} from "lucide-react"
import CourseAnnouncements from "@/components/announcements/CourseAnnouncements"
import CourseReviews from "@/components/course/CourseReviews"
import CertificateCard from "@/components/course/CertificateCard"

interface CourseMaterial {
  name: string
  path: string
  size?: number
  created: string
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
}

function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  useEffect(() => {
    if (!open) return
    const handleEsc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    document.addEventListener("keydown", handleEsc)
    return () => document.removeEventListener("keydown", handleEsc)
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-background border rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 id="modal-title" className="font-serif text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  )
}

function getCohortEnrollmentStatus(cohort: Cohort) {
  const now = new Date()
  const start = cohort.enrollment_start ? new Date(cohort.enrollment_start) : null
  const end = cohort.enrollment_end ? new Date(cohort.enrollment_end) : null
  if (start && now < start) return "not_started" as const
  if (end && now > end) return "closed" as const
  if (start || end) return "open" as const
  return "no_window" as const
}

export default function CourseDetail() {
  const { id } = useParams<{ id: string }>()
  const [course, setCourse] = useState<Course | null>(null)
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null)
  const [certificate, setCertificate] = useState<Certificate | null>(null)
  const [completedChapterIds, setCompletedChapterIds] = useState<Set<string>>(new Set())
  const [materials, setMaterials] = useState<CourseMaterial[]>([])
  const [cohorts, setCohorts] = useState<Cohort[]>([])
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([])
  const [downloadingPath, setDownloadingPath] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [enrolling, setEnrolling] = useState(false)
  const [materialsModal, setMaterialsModal] = useState(false)
  const [reviewsModal, setReviewsModal] = useState(false)
  const [cohortSelectModal, setCohortSelectModal] = useState(false)
  const [selectedCohortId, setSelectedCohortId] = useState<string | null>(null)
  const { user } = useAuth()

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      if (!id) return
      setLoading(true)
      setError(null)
      setCourse(null)
      setEnrollment(null)
      setCertificate(null)
      setCompletedChapterIds(new Set())
      setMaterials([])
      setCalendarEvents([])
      setCohorts([])
      try {
        const [courseData, enrollments, cohortsData] = await Promise.all([
          coursesService.getCourse(id),
          user ? coursesService.getMyCourses().catch(() => []) : Promise.resolve([]),
          coursesService.getCourseCohorts(id).catch(() => [] as Cohort[]),
        ])
        if (cancelled) return
        setCourse(courseData)
        setCohorts(cohortsData)
        const match = enrollments.find((e) => e.course_id === id)
        if (match) {
          setEnrollment(match)
          const [cert, progress, mats, evts] = await Promise.all([
            coursesService.getCourseCertificate(id),
            coursesService.getMyChapterProgress(id).catch(() => [] as string[]),
            storageService.listCourseMaterials(id).catch(() => [] as CourseMaterial[]),
            coursesService.getCalendarEvents(id).catch(() => [] as CalendarEvent[]),
          ])
          if (cancelled) return
          setCertificate(cert)
          setCompletedChapterIds(new Set(progress))
          setMaterials(mats)
          setCalendarEvents(evts)
        }
      } catch {
        if (!cancelled) setError("Failed to load course. Please try again.")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [id, user])

  const handleEnrollClick = () => {
    if (!id || !user) return
    const enrollableCohorts = cohorts.filter(
      (c) => (c.status === "active" || c.status === "upcoming") && getCohortEnrollmentStatus(c) === "open"
    )
    if (enrollableCohorts.length === 0) {
      doEnroll(undefined)
    } else if (enrollableCohorts.length === 1) {
      doEnroll(enrollableCohorts[0].id)
    } else {
      setSelectedCohortId(enrollableCohorts[0].id)
      setCohortSelectModal(true)
    }
  }

  const doEnroll = async (cohortId?: string) => {
    if (!id || !user) return
    setEnrolling(true)
    setCohortSelectModal(false)
    try {
      const enrolled = await coursesService.enrollInCourse(id, cohortId)
      setEnrollment(enrolled)
      const [cert, progress, mats, evts] = await Promise.all([
        coursesService.getCourseCertificate(id),
        coursesService.getMyChapterProgress(id).catch(() => [] as string[]),
        storageService.listCourseMaterials(id).catch(() => [] as CourseMaterial[]),
        coursesService.getCalendarEvents(id).catch(() => [] as CalendarEvent[]),
      ])
      setCertificate(cert)
      setCompletedChapterIds(new Set(progress))
      setMaterials(mats)
      setCalendarEvents(evts)
      toast({ title: "Enrolled successfully", variant: "success" })
    } catch {
      toast({ title: "Failed to enroll. Please try again.", variant: "destructive" })
    } finally {
      setEnrolling(false)
    }
  }

  const handleDownload = useCallback(async (path: string) => {
    setDownloadingPath(path)
    try {
      const url = await storageService.getSignedMaterialUrl(path)
      window.open(url, "_blank")
    } catch {
      toast({ title: "Failed to download file", variant: "destructive" })
    } finally {
      setDownloadingPath(null)
    }
  }, [])

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-6 max-w-4xl">
        <div className="h-8 w-24 animate-pulse bg-muted rounded mb-4" />
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="w-full sm:w-36 h-24 animate-pulse bg-muted rounded-lg shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-7 w-3/4 animate-pulse bg-muted rounded" />
            <div className="h-4 w-1/2 animate-pulse bg-muted rounded" />
          </div>
        </div>
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 animate-pulse bg-muted rounded-lg" />
          ))}
        </div>
      </div>
    )
  }

  if (error || !course) {
    return (
      <div className="container mx-auto px-4 py-12 text-center">
        <BookOpen className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
        <h2 className="text-lg font-medium mb-2">{error ?? "Course not found"}</h2>
        <Link to="/">
          <Button variant="outline" size="sm">Back to Courses</Button>
        </Link>
      </div>
    )
  }

  const isEnrolled = !!enrollment
  const isOwner = user?.id === course.created_by || user?.role === "admin"
  const sortedModules = [...(course.modules ?? [])].sort((a, b) => {
    const da = a.due_date ? new Date(a.due_date).getTime() : Infinity
    const db = b.due_date ? new Date(b.due_date).getTime() : Infinity
    if (da !== db) return da - db
    return a.order_index - b.order_index
  })
  const totalChapters = sortedModules.reduce((sum, m) => sum + (m.chapters?.length ?? 0), 0)

  const activeCohort = cohorts.find((c) => c.status === "active")
  const enrollableCohorts = cohorts.filter(
    (c) => (c.status === "active" || c.status === "upcoming") && getCohortEnrollmentStatus(c) === "open"
  )
  const canEnroll = enrollableCohorts.length > 0 || (!cohorts.length)

  // ========== VIEW A: Not enrolled ==========
  if (!isEnrolled) {
    return (
      <div className="container mx-auto px-4 py-6 max-w-3xl">
        <Link to="/">
          <Button variant="ghost" size="sm" className="mb-4 h-8 text-xs">
            <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
            All Courses
          </Button>
        </Link>

        {course.image_url && (
          <div className="w-full h-48 sm:h-56 overflow-hidden rounded-xl bg-muted mb-6">
            <img
              src={course.image_url}
              alt={course.title}
              className="w-full h-full object-cover"
              onError={(e) => { (e.currentTarget.parentElement as HTMLElement).style.display = "none" }}
            />
          </div>
        )}

        <h1 className="font-serif text-3xl sm:text-4xl font-bold tracking-tight mb-3">
          {course.title}
        </h1>

        {course.description && (
          <p className="text-muted-foreground leading-relaxed mb-6">
            {course.description}
          </p>
        )}

        {activeCohort && (
          <Card className="mb-6">
            <CardContent className="py-4">
              <div className="flex items-center gap-2 mb-1">
                <CalendarDays className="h-4 w-4 text-primary" />
                <span className="font-medium">{activeCohort.name}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  activeCohort.status === "active"
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400"
                    : "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400"
                }`}>
                  {activeCohort.status}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                {formatDate(activeCohort.start_date)} &mdash; {formatDate(activeCohort.end_date)}
              </p>
              {activeCohort.enrollment_start && activeCohort.enrollment_end && (
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Enrollment: {formatDate(activeCohort.enrollment_start)} &mdash; {formatDate(activeCohort.enrollment_end)}
                </p>
              )}
              {activeCohort.max_students && (
                <p className="text-xs text-muted-foreground mt-1">
                  {activeCohort.student_count}/{activeCohort.max_students} students enrolled
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {!activeCohort && cohorts.length === 0 && (course.enrollment_start || course.enrollment_end) && (
          <div className="flex flex-wrap items-center gap-2 text-sm mb-6">
            <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
            {course.enrollment_start && course.enrollment_end && (
              <span className="text-muted-foreground text-xs">
                Enrollment: {formatDate(course.enrollment_start)} &mdash; {formatDate(course.enrollment_end)}
              </span>
            )}
          </div>
        )}

        <div>
          {isOwner ? (
            <Link to={`/teacher/courses/${id}`}>
              <Button size="lg" variant="outline">
                Manage Course
              </Button>
            </Link>
          ) : user ? (
            <div>
              <Button onClick={handleEnrollClick} disabled={enrolling || !canEnroll} size="lg">
                <Users className="h-4 w-4 mr-2" />
                {!canEnroll
                  ? "Enrollment not available"
                  : enrolling
                    ? "Enrolling..."
                    : "Enroll in Course"}
              </Button>
              {!canEnroll && (
                <p className="text-sm text-muted-foreground mt-2">
                  {cohorts.length > 0
                    ? "Enrollment window is closed for all available cohorts."
                    : "No cohorts are currently available for this course."}
                </p>
              )}
            </div>
          ) : (
            <Link to="/login">
              <Button size="lg">Sign in to Enroll</Button>
            </Link>
          )}
        </div>

        {/* Cohort selection modal */}
        <Modal open={cohortSelectModal} onClose={() => setCohortSelectModal(false)} title="Select a Cohort">
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Multiple cohorts are available. Choose one to enroll in:</p>
            {enrollableCohorts.map((cohort) => (
              <label
                key={cohort.id}
                className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                  selectedCohortId === cohort.id
                    ? "border-primary bg-primary/5"
                    : "hover:bg-muted/50"
                }`}
              >
                <input
                  type="radio"
                  name="cohort"
                  checked={selectedCohortId === cohort.id}
                  onChange={() => setSelectedCohortId(cohort.id)}
                  className="accent-primary"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{cohort.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(cohort.start_date)} &mdash; {formatDate(cohort.end_date)}
                  </p>
                  {cohort.max_students && (
                    <p className="text-xs text-muted-foreground">
                      {cohort.student_count}/{cohort.max_students} spots filled
                    </p>
                  )}
                </div>
              </label>
            ))}
            <Button
              onClick={() => selectedCohortId && doEnroll(selectedCohortId)}
              disabled={!selectedCohortId || enrolling}
              className="w-full"
            >
              {enrolling ? "Enrolling..." : "Enroll"}
            </Button>
          </div>
        </Modal>
      </div>
    )
  }

  // ========== VIEW B: Enrolled ==========
  const enrolledCohort = cohorts.find((c) => c.id === enrollment.cohort_id)

  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl">
      <Link to="/">
        <Button variant="ghost" size="sm" className="mb-4 h-8 text-xs">
          <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
          All Courses
        </Button>
      </Link>

      {/* Compact course header */}
      <div className="flex flex-col sm:flex-row gap-4 mb-5">
        {course.image_url && (
          <div className="w-full sm:w-36 h-24 overflow-hidden rounded-lg bg-muted shrink-0">
            <img
              src={course.image_url}
              alt={course.title}
              className="w-full h-full object-cover"
              onError={(e) => { (e.currentTarget.parentElement as HTMLElement).style.display = "none" }}
            />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight mb-1">
            {course.title}
          </h1>
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            {enrolledCohort && (
              <span className="flex items-center gap-1 font-medium text-primary">
                <CalendarDays className="h-3.5 w-3.5" />
                {enrolledCohort.name}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Layers className="h-3.5 w-3.5" />
              {sortedModules.length} modules
            </span>
            <span className="flex items-center gap-1">
              <BookOpen className="h-3.5 w-3.5" />
              {totalChapters} chapters
            </span>
            <span className="flex items-center gap-1 text-green-600 dark:text-green-400 font-medium">
              <CheckCircle className="h-3.5 w-3.5" />
              {enrollment.progress}% complete
            </span>
          </div>
        </div>
      </div>

      {id && <CourseAnnouncements courseId={id} />}

      {/* Upcoming Deadlines */}
      {calendarEvents.length > 0 && (() => {
        const now = new Date()
        const upcoming = calendarEvents
          .filter((e) => new Date(e.event_date).getTime() > now.getTime() - 24 * 60 * 60 * 1000)
          .slice(0, 5)
        if (upcoming.length === 0) return null
        return (
          <div className="mb-5">
            <h2 className="text-sm font-semibold mb-2 flex items-center gap-2 text-muted-foreground">
              <CalendarDays className="h-3.5 w-3.5" />
              Upcoming Deadlines & Events
            </h2>
            <div className="space-y-1.5">
              {upcoming.map((evt) => {
                const evtDate = new Date(evt.event_date)
                const overdue = evtDate < now && evt.event_type === "deadline"
                return (
                  <div
                    key={evt.id}
                    className={`flex items-center gap-2 px-3 py-2 rounded-md border text-sm ${
                      overdue
                        ? "border-red-200 bg-red-50/50 dark:bg-red-950/20 dark:border-red-800"
                        : "border-border hover:bg-muted/50"
                    }`}
                  >
                    {overdue ? (
                      <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0" />
                    ) : (
                      <span className={`w-2 h-2 rounded-full shrink-0 ${
                        evt.event_type === "deadline" ? "bg-red-500"
                          : evt.event_type === "live_session" ? "bg-blue-500"
                            : evt.event_type === "exam" ? "bg-orange-500"
                              : "bg-gray-400"
                      }`} />
                    )}
                    <span className={`flex-1 truncate ${overdue ? "text-red-600 dark:text-red-400" : ""}`}>
                      {evt.title}
                    </span>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {evtDate.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })()}

      {/* Module list */}
      <div>
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <BookOpen className="h-4 w-4" />
          Modules
          <span className="text-sm font-normal text-muted-foreground">
            ({sortedModules.length})
          </span>
        </h2>

        {sortedModules.length > 0 ? (
          <div className="space-y-2">
            {sortedModules.map((module, idx) => {
              const chapters = [...(module.chapters ?? [])].sort(
                (a, b) => a.order_index - b.order_index,
              )
              const GRADABLE_TYPES = new Set(["quiz", "exam", "assignment"])
              const gradable = chapters.filter((ch) => GRADABLE_TYPES.has(ch.chapter_type ?? ""))
              const gradableCount = gradable.length

              const isLocked = (() => {
                if (idx === 0) return false
                const prevModule = sortedModules[idx - 1]
                const prevChapters = (prevModule.chapters ?? []).filter((ch) => GRADABLE_TYPES.has(ch.chapter_type ?? ""))
                if (prevChapters.length === 0) return false
                return !prevChapters.every((ch) => completedChapterIds.has(ch.id))
              })()

              const allComplete = gradableCount > 0 && gradable.every((ch) => completedChapterIds.has(ch.id))
              const completedInModule = gradable.filter((ch) => completedChapterIds.has(ch.id)).length

              return (
                <Card
                  key={module.id}
                  className={`group transition-all ${isLocked ? "opacity-60" : "hover:shadow-sm"}`}
                >
                  <CardHeader className="py-3 px-4">
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle className="flex items-center gap-2 text-sm font-medium">
                        <span className={`flex items-center justify-center h-6 w-6 rounded-full text-xs font-bold shrink-0 ${
                          isLocked
                            ? "bg-muted text-muted-foreground"
                            : allComplete
                              ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                              : "bg-primary/10 text-primary"
                        }`}>
                          {isLocked ? <Lock className="h-3 w-3" /> : allComplete ? <CheckCircle className="h-3 w-3" /> : idx + 1}
                        </span>
                        <span className="truncate">{module.title}</span>
                        <span className="text-xs font-normal text-muted-foreground whitespace-nowrap">
                          {gradableCount > 0 ? `${completedInModule}/${gradableCount}` : `${chapters.length} ch.`}
                        </span>
                      </CardTitle>
                      {!isLocked && (
                        <Link to={`/courses/${id}/modules/${module.id}`}>
                          <Button variant="ghost" size="sm" className="h-7 text-xs shrink-0">
                            Open
                            <ArrowRight className="h-3 w-3 ml-1" />
                          </Button>
                        </Link>
                      )}
                      {isLocked && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Lock className="h-3 w-3" />
                          Locked
                        </span>
                      )}
                    </div>
                    {isLocked && (
                      <p className="text-xs text-muted-foreground ml-8 mt-1">
                        Complete all assessments in the previous module to unlock.
                      </p>
                    )}
                    {module.description && (
                      <CardDescription className="text-xs ml-8 mt-0.5">
                        {module.description}
                      </CardDescription>
                    )}
                    {module.due_date && (() => {
                      const dueDate = new Date(module.due_date)
                      const now = new Date()
                      const overdue = dueDate < now && !allComplete
                      return (
                        <div className={`ml-8 mt-1 flex items-center gap-1 text-[10px] ${
                          overdue ? "text-red-500" : "text-muted-foreground"
                        }`}>
                          {overdue ? <AlertTriangle className="h-2.5 w-2.5" /> : <Clock className="h-2.5 w-2.5" />}
                          <span>{overdue ? "Overdue" : "Due"}: {formatDate(module.due_date)}</span>
                        </div>
                      )
                    })()}
                  </CardHeader>
                </Card>
              )
            })}
          </div>
        ) : (
          <Card className="border-dashed">
            <CardContent className="py-8 text-center text-muted-foreground text-sm">
              No modules added yet
            </CardContent>
          </Card>
        )}
      </div>

      {/* Certificate card (compact) */}
      {id && (
        <div className="mt-6">
          <CertificateCard
            courseId={id}
            progress={enrollment.progress}
            certificate={certificate}
            onCertificateUpdate={setCertificate}
          />
        </div>
      )}

      {/* Bottom action buttons */}
      <div className="flex items-center gap-2 mt-6">
        {materials.length > 0 && (
          <Button variant="outline" size="sm" onClick={() => setMaterialsModal(true)}>
            <Paperclip className="h-3.5 w-3.5 mr-1.5" />
            Materials ({materials.length})
          </Button>
        )}
        {id && (
          <Button variant="outline" size="sm" onClick={() => setReviewsModal(true)}>
            <Star className="h-3.5 w-3.5 mr-1.5" />
            Reviews
          </Button>
        )}
      </div>

      {/* Materials Modal */}
      <Modal open={materialsModal} onClose={() => setMaterialsModal(false)} title="Course Materials">
        {materials.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">No materials available.</p>
        ) : (
          <div className="divide-y rounded-md border text-sm">
            {materials.map((file) => (
              <div
                key={file.path}
                className="flex items-center justify-between px-3 py-2 hover:bg-muted/50 transition-colors"
              >
                <span className="truncate mr-2">{file.name}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="shrink-0 h-7 text-xs"
                  disabled={downloadingPath === file.path}
                  onClick={() => handleDownload(file.path)}
                >
                  {downloadingPath === file.path ? (
                    <div className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  ) : (
                    <Download className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>
            ))}
          </div>
        )}
      </Modal>

      {/* Reviews Modal */}
      <Modal open={reviewsModal} onClose={() => setReviewsModal(false)} title="Course Reviews">
        {id && <CourseReviews courseId={id} />}
      </Modal>
    </div>
  )
}
