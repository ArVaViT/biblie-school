import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { coursesService } from "@/services/courses"
import { useAuth } from "@/context/AuthContext"
import type { Enrollment, Certificate, StudentGrade } from "@/types"
import DashboardSkeleton from "@/components/skeletons/DashboardSkeleton"
import { BookOpen, GraduationCap, BookOpenCheck, ArrowRight, Award, Copy, CheckCircle, TrendingUp } from "lucide-react"

export default function Dashboard() {
  const { user } = useAuth()
  const [enrollments, setEnrollments] = useState<Enrollment[]>([])
  const [certificates, setCertificates] = useState<Certificate[]>([])
  const [grades, setGrades] = useState<StudentGrade[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const [enrollData, certData, gradeData] = await Promise.all([
        coursesService.getMyCourses(),
        coursesService.getMyCertificates().catch(() => []),
        coursesService.getMyGrades().catch(() => []),
      ])
      setEnrollments(enrollData)
      setCertificates(certData)
      setGrades(gradeData)
    } catch {
      setError("Failed to load your courses. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const isTeacher = user?.role === "teacher" || user?.role === "admin"
  const RoleIcon = isTeacher ? BookOpenCheck : GraduationCap
  const filteredEnrollments = enrollments.filter(
    (e) => e.course?.created_by !== user?.id
  )

  return (
    <div className="container mx-auto px-4 py-10 max-w-5xl">
      <div className="mb-10">
        <div className="flex items-center gap-4 mb-1">
          <div className="h-11 w-11 rounded-md bg-primary/10 flex items-center justify-center">
            <RoleIcon className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="font-serif text-2xl font-bold tracking-tight">
              Welcome back, {user?.full_name?.split(" ")[0] || "there"}
            </h1>
            <p className="text-sm text-muted-foreground capitalize tracking-wide">{user?.role} portal</p>
          </div>
        </div>
      </div>

      {isTeacher && (
        <Card className="mb-6 bg-primary/5 border-primary/20">
          <CardContent className="flex items-center justify-between py-4">
            <div>
              <h3 className="font-medium text-sm">Teacher Tools</h3>
              <p className="text-xs text-muted-foreground">Create and manage your courses</p>
            </div>
            <Link to="/teacher">
              <Button size="sm" variant="outline" className="h-8 text-xs">
                Manage Courses
                <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-accent" />
            <CardTitle className="font-serif text-lg">My Courses</CardTitle>
          </div>
          <CardDescription>Courses you are enrolled in</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <DashboardSkeleton />
          ) : error ? (
            <div className="text-center py-12">
              <BookOpen className="h-10 w-10 text-destructive/40 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground mb-4">{error}</p>
              <Button size="sm" variant="outline" onClick={load}>
                Try again
              </Button>
            </div>
          ) : filteredEnrollments.length === 0 ? (
            <div className="text-center py-12">
              <BookOpen className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground mb-4">
                You are not enrolled in any courses yet
              </p>
              <Link to="/">
                <Button size="sm">Browse Courses</Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredEnrollments.map((enrollment) => {
                const grade = grades.find((g) => g.course_id === enrollment.course_id)
                const progressColor =
                  enrollment.progress >= 100
                    ? "bg-emerald-500"
                    : enrollment.progress >= 60
                      ? "bg-primary"
                      : enrollment.progress >= 30
                        ? "bg-amber-500"
                        : "bg-red-400"

                return (
                  <div
                    key={enrollment.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-sm truncate">
                          {enrollment.course?.title || "Course"}
                        </h3>
                        {enrollment.progress >= 100 && (
                          <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />
                        )}
                      </div>
                      <div className="flex items-center gap-4 mt-2">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-32 bg-muted rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${progressColor}`}
                              style={{ width: `${Math.min(enrollment.progress, 100)}%` }}
                            />
                          </div>
                          <span className="text-xs font-medium text-muted-foreground tabular-nums">
                            {enrollment.progress}%
                          </span>
                        </div>
                        {grade?.grade && (
                          <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary dark:bg-primary/15 dark:text-primary rounded-md font-medium">
                            Grade: {grade.grade}
                          </span>
                        )}
                      </div>
                    </div>
                    {enrollment.course && (
                      <Link to={`/courses/${enrollment.course.id}`}>
                        <Button variant="ghost" size="sm" className="h-8 text-xs shrink-0 ml-4">
                          {enrollment.progress >= 100 ? "View" : "Continue"}
                          <ArrowRight className="h-3.5 w-3.5 ml-1" />
                        </Button>
                      </Link>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Grades Overview */}
      {!loading && grades.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-accent" />
              <CardTitle className="font-serif text-lg">My Grades</CardTitle>
            </div>
            <CardDescription>Your grades across all courses</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {grades.map((g) => {
                const course = enrollments.find((e) => e.course_id === g.course_id)?.course
                return (
                  <div key={g.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{course?.title || "Course"}</p>
                      {g.comment && (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">{g.comment}</p>
                      )}
                    </div>
                    <span className="text-lg font-bold ml-3 tabular-nums">{g.grade || "—"}</span>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Certificates */}
      {!loading && certificates.length > 0 && (
        <Card className="mt-6 border-accent/20 dark:border-accent/10 bg-accent/[0.03]">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Award className="h-5 w-5 text-accent" />
              <CardTitle className="font-serif text-lg">My Certificates</CardTitle>
            </div>
            <CardDescription>Certificates you have earned</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {certificates.map((cert) => {
                const course = enrollments.find((e) => e.course_id === cert.course_id)?.course
                return (
                  <CertificateItem key={cert.id} certificate={cert} courseTitle={course?.title} />
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function CertificateItem({
  certificate,
  courseTitle,
}: {
  certificate: Certificate
  courseTitle?: string
}) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(certificate.certificate_number)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {}
  }

  return (
    <div className="flex items-center gap-4 p-4 border border-border/60 rounded-md bg-card">
      <div className="h-10 w-10 rounded-md bg-accent/15 flex items-center justify-center shrink-0">
        <Award className="h-5 w-5 text-accent" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{courseTitle || "Course"}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <code className="font-mono text-xs text-muted-foreground select-all">
            {certificate.certificate_number}
          </code>
          <button onClick={handleCopy} className="text-muted-foreground hover:text-foreground transition-colors">
            {copied ? (
              <CheckCircle className="h-3 w-3 text-emerald-500" />
            ) : (
              <Copy className="h-3 w-3" />
            )}
          </button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground shrink-0">
        {new Date(certificate.issued_at).toLocaleDateString()}
      </p>
    </div>
  )
}
