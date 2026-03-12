import { useEffect, useState, useCallback } from "react"
import { useParams, Link } from "react-router-dom"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { coursesService } from "@/services/courses"
import { storageService } from "@/services/storage"
import { useAuth } from "@/context/AuthContext"
import type { Course, Enrollment, Certificate } from "@/types"
import { toast } from "@/hooks/use-toast"
import { BookOpen, ArrowRight, CheckCircle, Users, Layers, ArrowLeft, CalendarDays, Clock, Lock, Download, Paperclip } from "lucide-react"
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

function getEnrollmentStatus(course: Course) {
  const now = new Date()
  const start = course.enrollment_start ? new Date(course.enrollment_start) : null
  const end = course.enrollment_end ? new Date(course.enrollment_end) : null

  if (start && now < start) return "not_started" as const
  if (end && now > end) return "closed" as const
  if (start || end) return "open" as const
  return "no_window" as const
}

function getCountdown(target: Date) {
  const now = new Date()
  const diff = target.getTime() - now.getTime()
  if (diff <= 0) return null
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24)
  if (days > 0) return `${days}d ${hours}h`
  const minutes = Math.floor((diff / (1000 * 60)) % 60)
  return `${hours}h ${minutes}m`
}

export default function CourseDetail() {
  const { id } = useParams<{ id: string }>()
  const [course, setCourse] = useState<Course | null>(null)
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null)
  const [certificate, setCertificate] = useState<Certificate | null>(null)
  const [completedChapterIds, setCompletedChapterIds] = useState<Set<string>>(new Set())
  const [materials, setMaterials] = useState<CourseMaterial[]>([])
  const [downloadingPath, setDownloadingPath] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [enrolling, setEnrolling] = useState(false)
  const { user } = useAuth()

  useEffect(() => {
    const load = async () => {
      if (!id) return
      try {
        const [courseData, enrollments] = await Promise.all([
          coursesService.getCourse(id),
          user ? coursesService.getMyCourses().catch(() => []) : Promise.resolve([]),
        ])
        setCourse(courseData)
        const match = enrollments.find((e) => e.course_id === id)
        if (match) {
          setEnrollment(match)
          const [cert, progress] = await Promise.all([
            coursesService.getCourseCertificate(id),
            coursesService.getMyChapterProgress(id).catch(() => [] as string[]),
          ])
          setCertificate(cert)
          setCompletedChapterIds(new Set(progress))
        }
        try {
          const files = await storageService.listCourseMaterials(id)
          setMaterials(files)
        } catch { /* non-critical */ }
      } catch {
        setError("Failed to load course. Please try again.")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id, user?.id])

  const handleEnroll = async () => {
    if (!id || !user) return
    setEnrolling(true)
    try {
      const enrolled = await coursesService.enrollInCourse(id)
      setEnrollment(enrolled)
      toast({ title: "Enrolled successfully", variant: "success" })
    } catch {
      setError("Failed to enroll. Please try again.")
      toast({ title: "Failed to enroll", variant: "destructive" })
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
      <div className="flex justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
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

  const sortedModules = [...(course.modules ?? [])].sort(
    (a, b) => a.order_index - b.order_index,
  )
  const totalChapters = sortedModules.reduce(
    (sum, m) => sum + (m.chapters?.length ?? 0), 0,
  )
  const isEnrolled = !!enrollment

  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl">
      <Link to="/">
        <Button variant="ghost" size="sm" className="mb-4 h-8 text-xs">
          <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
          All Courses
        </Button>
      </Link>

      {/* Course header: image + info side by side */}
      <div className="flex flex-col sm:flex-row gap-5 mb-5">
        {course.image_url && (
          <div className="w-full sm:w-48 h-40 sm:h-32 overflow-hidden rounded-lg bg-muted shrink-0">
            <img
              src={course.image_url}
              alt={course.title}
              className="w-full h-full object-cover"
              onError={(e) => { (e.currentTarget.parentElement as HTMLElement).style.display = "none" }}
            />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-1">
            {course.title}
          </h1>
          {course.description && (
            <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3">
              {course.description}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Layers className="h-3.5 w-3.5" />
              {sortedModules.length} modules
            </span>
            <span className="flex items-center gap-1">
              <BookOpen className="h-3.5 w-3.5" />
              {totalChapters} chapters
            </span>
            {isEnrolled && (
              <span className="flex items-center gap-1 text-green-600 dark:text-green-400 font-medium">
                <CheckCircle className="h-3.5 w-3.5" />
                Enrolled &middot; {enrollment.progress}%
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Enrollment window badge */}
      {(() => {
        const enrollStatus = getEnrollmentStatus(course)
        const hasWindow = course.enrollment_start || course.enrollment_end
        return hasWindow ? (
          <div className="flex flex-wrap items-center gap-2 text-sm mb-4">
            <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
            {enrollStatus === "open" && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2.5 py-0.5 text-xs font-medium">
                <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                Enrollment open
              </span>
            )}
            {enrollStatus === "not_started" && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-2.5 py-0.5 text-xs font-medium">
                <Clock className="h-3 w-3" />
                Opens in {getCountdown(new Date(course.enrollment_start!)) ?? "soon"}
              </span>
            )}
            {enrollStatus === "closed" && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 px-2.5 py-0.5 text-xs font-medium">
                Enrollment closed
              </span>
            )}
            {course.enrollment_start && course.enrollment_end && (
              <span className="text-muted-foreground text-xs">
                {formatDate(course.enrollment_start)} &mdash; {formatDate(course.enrollment_end)}
              </span>
            )}
          </div>
        ) : null
      })()}

      {/* Enroll / Sign in (only when not enrolled) */}
      {!isEnrolled && (
        <div className="mb-5">
          {user ? (
            (() => {
              const enrollStatus = getEnrollmentStatus(course)
              const canEnroll = enrollStatus === "open" || enrollStatus === "no_window"
              return (
                <Button onClick={handleEnroll} disabled={enrolling || !canEnroll}>
                  <Users className="h-4 w-4 mr-2" />
                  {!canEnroll
                    ? enrollStatus === "not_started"
                      ? "Enrollment not yet open"
                      : "Enrollment closed"
                    : enrolling
                      ? "Enrolling..."
                      : "Enroll in Course"}
                </Button>
              )
            })()
          ) : (
            <Link to="/login">
              <Button>Sign in to Enroll</Button>
            </Link>
          )}
        </div>
      )}

      {id && <CourseAnnouncements courseId={id} />}

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
              const chapterCount = chapters.length

              const isLocked = (() => {
                if (!isEnrolled || idx === 0) return false
                const prevModule = sortedModules[idx - 1]
                const prevChapters = prevModule.chapters ?? []
                if (prevChapters.length === 0) return false
                return !prevChapters.every((ch) => completedChapterIds.has(ch.id))
              })()

              const allComplete = isEnrolled && chapterCount > 0 && chapters.every((ch) => completedChapterIds.has(ch.id))
              const completedInModule = isEnrolled ? chapters.filter((ch) => completedChapterIds.has(ch.id)).length : 0

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
                          {isEnrolled && chapterCount > 0
                            ? `${completedInModule}/${chapterCount}`
                            : `${chapterCount} ch.`}
                        </span>
                      </CardTitle>
                      {isEnrolled && !isLocked && (
                        <Link to={`/courses/${id}/modules/${module.id}`}>
                          <Button variant="ghost" size="sm" className="h-7 text-xs shrink-0">
                            Open
                            <ArrowRight className="h-3 w-3 ml-1" />
                          </Button>
                        </Link>
                      )}
                      {isEnrolled && isLocked && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Lock className="h-3 w-3" />
                          Locked
                        </span>
                      )}
                    </div>
                    {module.description && (
                      <CardDescription className="text-xs ml-8 mt-0.5">
                        {module.description}
                      </CardDescription>
                    )}
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
      {isEnrolled && id && (
        <div className="mt-6">
          <CertificateCard
            courseId={id}
            progress={enrollment.progress}
            certificate={certificate}
            onCertificateUpdate={setCertificate}
          />
        </div>
      )}

      {/* Course Materials — small section, only if materials exist */}
      {isEnrolled && materials.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5 text-muted-foreground">
            <Paperclip className="h-3.5 w-3.5" />
            Course Materials ({materials.length})
          </h3>
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
        </div>
      )}

      {/* Reviews */}
      {id && (
        <div className="mt-6">
          <CourseReviews courseId={id} />
        </div>
      )}
    </div>
  )
}
