import { useEffect, useState } from "react"
import { useParams, Link } from "react-router-dom"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { coursesService } from "@/services/courses"
import { useAuth } from "@/context/AuthContext"
import type { Course, Enrollment, Certificate } from "@/types"
import { toast } from "@/hooks/use-toast"
import { BookOpen, Play, ArrowRight, CheckCircle, Users, Layers, ArrowLeft, CalendarDays, Clock } from "lucide-react"
import CourseAnnouncements from "@/components/announcements/CourseAnnouncements"
import CourseReviews from "@/components/course/CourseReviews"
import CertificateCard from "@/components/course/CertificateCard"

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
          const cert = await coursesService.getCourseCertificate(id)
          setCertificate(cert)
        }
      } catch (err) {
        console.error("Failed to load course:", err)
        setError("Failed to load course. Please try again.")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id, user])

  const handleEnroll = async () => {
    if (!id || !user) return
    setEnrolling(true)
    try {
      const enrolled = await coursesService.enrollInCourse(id)
      setEnrollment(enrolled)
      toast({ title: "Enrolled successfully", variant: "success" })
    } catch (err) {
      console.error("Failed to enroll:", err)
      setError("Failed to enroll. Please try again.")
      toast({ title: "Failed to enroll", variant: "destructive" })
    } finally {
      setEnrolling(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  if (error || !course) {
    return (
      <div className="container mx-auto px-4 py-20 text-center">
        <BookOpen className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
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
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <Link to="/">
        <Button variant="ghost" size="sm" className="mb-6 h-8 text-xs">
          <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
          All Courses
        </Button>
      </Link>

      {course.image_url && (
        <div className="w-full h-56 sm:h-72 mb-8 overflow-hidden rounded-xl bg-muted">
          <img
            src={course.image_url}
            alt={course.title}
            className="w-full h-full object-cover"
            onError={(e) => { (e.currentTarget.parentElement as HTMLElement).style.display = "none" }}
          />
        </div>
      )}

      <div className="mb-10">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3">
          {course.title}
        </h1>
        {course.description && (
          <p className="text-lg text-muted-foreground leading-relaxed max-w-2xl">
            {course.description}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-4 mt-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Layers className="h-4 w-4" />
            {sortedModules.length} modules
          </span>
          <span className="flex items-center gap-1.5">
            <BookOpen className="h-4 w-4" />
            {totalChapters} chapters
          </span>
        </div>

        {(() => {
          const enrollStatus = getEnrollmentStatus(course)
          const hasWindow = course.enrollment_start || course.enrollment_end
          return hasWindow ? (
            <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
              {enrollStatus === "open" && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-3 py-1 text-xs font-medium">
                  <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                  Enrollment open
                </span>
              )}
              {enrollStatus === "not_started" && (
                <>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-3 py-1 text-xs font-medium">
                    <Clock className="h-3 w-3" />
                    Enrollment opens in {getCountdown(new Date(course.enrollment_start!)) ?? "soon"}
                  </span>
                </>
              )}
              {enrollStatus === "closed" && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 px-3 py-1 text-xs font-medium">
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

        {user && (
          <div className="mt-6">
            {isEnrolled ? (
              <div className="flex items-center gap-3">
                <Button variant="outline" disabled className="pointer-events-none">
                  <CheckCircle className="h-4 w-4 mr-2 text-green-500" />
                  Enrolled
                </Button>
                <span className="text-sm text-muted-foreground">
                  Progress: {enrollment.progress}%
                </span>
              </div>
            ) : (
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
            )}
          </div>
        )}

        {!user && (
          <div className="mt-6">
            <Link to="/login">
              <Button>Sign in to Enroll</Button>
            </Link>
          </div>
        )}
      </div>

      {id && <CourseAnnouncements courseId={id} />}

      <div>
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <BookOpen className="h-5 w-5" />
          Course Modules
          <span className="text-sm font-normal text-muted-foreground ml-1">
            ({sortedModules.length})
          </span>
        </h2>

        {sortedModules.length > 0 ? (
          <div className="space-y-3">
            {sortedModules.map((module, idx) => {
              const chapters = [...(module.chapters ?? [])].sort(
                (a, b) => a.order_index - b.order_index,
              )
              return (
                <Card key={module.id} className="group hover:shadow-md transition-all">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <span className="flex items-center justify-center h-7 w-7 rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0">
                        {idx + 1}
                      </span>
                      {module.title}
                    </CardTitle>
                    {module.description && (
                      <CardDescription className="text-xs ml-9">
                        {module.description}
                      </CardDescription>
                    )}
                  </CardHeader>
                  <CardContent className="pt-0 ml-9">
                    {chapters.length > 0 && (
                      <ul className="text-xs text-muted-foreground space-y-1 mb-2">
                        {chapters.map((ch) => (
                          <li key={ch.id} className="flex items-center gap-1.5">
                            <Play className="h-3 w-3 shrink-0" />
                            {ch.title}
                          </li>
                        ))}
                      </ul>
                    )}
                    {isEnrolled && (
                      <Link to={`/courses/${id}/modules/${module.id}`}>
                        <Button variant="ghost" size="sm" className="h-8 text-xs group/btn">
                          Open Module
                          <ArrowRight className="h-3.5 w-3.5 ml-1 transition-transform group-hover/btn:translate-x-0.5" />
                        </Button>
                      </Link>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        ) : (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center text-muted-foreground text-sm">
              No modules added yet
            </CardContent>
          </Card>
        )}
      </div>

      {isEnrolled && id && (
        <div className="mt-10">
          <CertificateCard
            courseId={id}
            progress={enrollment.progress}
            certificate={certificate}
            onCertificateUpdate={setCertificate}
          />
        </div>
      )}

      {id && (
        <div className="mt-10">
          <CourseReviews courseId={id} isEnrolled={isEnrolled} certificate={certificate} />
        </div>
      )}
    </div>
  )
}
