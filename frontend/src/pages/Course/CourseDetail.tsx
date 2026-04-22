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
  CalendarDays, Clock, Lock, Download, Paperclip, Star, AlertTriangle,
} from "lucide-react"
import CourseAnnouncements from "@/components/announcements/CourseAnnouncements"
import CourseReviews from "@/components/course/CourseReviews"
import CertificateCard from "@/components/course/CertificateCard"
import { Badge } from "@/components/ui/badge"
import { toProxyImage } from "@/lib/images"

interface CourseMaterial {
  name: string
  path: string
  size?: number
  created: string | null
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
}

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"

function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  // See CourseEditor.Modal — delegates to Radix Dialog for accessible focus
  // trapping and keyboard handling.
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif">{title}</DialogTitle>
        </DialogHeader>
        <div className="pt-2">{children}</div>
      </DialogContent>
    </Dialog>
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
        const [courseData, enrollmentStatus, cohortsData] = await Promise.all([
          coursesService.getCourse(id),
          user
            ? coursesService
                .getEnrollmentStatus(id)
                .catch(() => ({ enrolled: false, enrollment: null as Enrollment | null }))
            : Promise.resolve({ enrolled: false, enrollment: null as Enrollment | null }),
          coursesService.getCourseCohorts(id).catch(() => [] as Cohort[]),
        ])
        if (cancelled) return
        setCourse(courseData)
        setCohorts(cohortsData)
        const match = enrollmentStatus.enrolled ? enrollmentStatus.enrollment : null
        if (match) {
          setEnrollment(match)
          const [cert, progress, mats, evts] = await Promise.all([
            coursesService.getCourseCertificate(id).catch(() => null),
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
    // Reload only when identity changes, not on every `user` object reference.
    // Supabase rewrites the whole object on every TOKEN_REFRESHED tick, which
    // used to refetch the entire course detail every ~55 minutes mid-session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, user?.id])

  const handleEnrollClick = () => {
    if (!id || !user) return
    const enrollableCohorts = cohorts.filter(
      (c) => (c.status === "active" || c.status === "upcoming") && getCohortEnrollmentStatus(c) === "open"
    )
    if (enrollableCohorts.length === 0) {
      doEnroll(undefined)
    } else if (enrollableCohorts.length === 1) {
      const first = enrollableCohorts[0]
      if (first) doEnroll(first.id)
    } else {
      const first = enrollableCohorts[0]
      if (first) setSelectedCohortId(first.id)
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
      window.open(url, "_blank", "noopener,noreferrer")
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
          <div className="mb-6 w-full aspect-[16/9] overflow-hidden rounded-md border bg-muted">
            <img
              src={toProxyImage(course.image_url)}
              alt={course.title}
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover"
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
                <Badge variant={activeCohort.status === "active" ? "success" : "info"}>
                  {activeCohort.status}
                </Badge>
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
              src={toProxyImage(course.image_url)}
              alt={course.title}
              loading="lazy"
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
            <span className="flex items-center gap-1 font-medium text-success">
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
          .filter((e) => {
            if (!e.event_date) return false
            const t = new Date(e.event_date).getTime()
            return !Number.isNaN(t) && t > now.getTime() - 24 * 60 * 60 * 1000
          })
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
                        ? "border-l-[3px] border-l-destructive border-border bg-destructive/5"
                        : "border-border hover:bg-muted/50"
                    }`}
                  >
                    {overdue ? (
                      <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />
                    ) : (
                      <span className={`h-2 w-2 shrink-0 rounded-full ${
                        evt.event_type === "deadline" ? "bg-destructive"
                          : evt.event_type === "live_session" ? "bg-info"
                            : evt.event_type === "exam" ? "bg-warning"
                              : "bg-muted-foreground/50"
                      }`} />
                    )}
                    <span className={`flex-1 truncate ${overdue ? "text-destructive" : ""}`}>
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
                if (!prevModule) return false
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
                        <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                          isLocked
                            ? "bg-muted text-muted-foreground"
                            : allComplete
                              ? "bg-success/15 text-success"
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
                        <div className={`ml-8 mt-1 flex items-center gap-1 text-[11px] ${
                          overdue ? "text-destructive" : "text-muted-foreground"
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
            key={id}
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
