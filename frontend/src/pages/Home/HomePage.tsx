import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { coursesService } from "@/services/courses"
import type { Course, Enrollment, StudentGrade } from "@/types"
import { useAuth } from "@/context/useAuth"
import { useDebouncedSearchParam } from "@/hooks/useDebouncedSearchParam"
import CourseCard from "@/components/course/CourseCard"
import CourseCardSkeleton from "@/components/skeletons/CourseCardSkeleton"
import { Search, BookOpen, LogIn, ArrowRight, CheckCircle } from "lucide-react"

function MyCoursesSection() {
  const { user } = useAuth()
  const [enrollments, setEnrollments] = useState<Enrollment[]>([])
  const [grades, setGrades] = useState<StudentGrade[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState(false)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const [enrollData, gradeData] = await Promise.all([
          coursesService.getMyCourses(),
          coursesService.getMyGrades().catch(() => []),
        ])
        if (cancelled) return
        setEnrollments(enrollData)
        setGrades(gradeData)
        setFetchError(false)
      } catch {
        if (!cancelled) setFetchError(true)
      }
      finally { if (!cancelled) setLoading(false) }
    }
    load()
    return () => { cancelled = true }
  }, [user?.id])

  const filtered = enrollments.filter((e) => e.course?.created_by !== user?.id)

  if (loading) {
    return (
      <Card className="mb-10">
        <CardHeader>
          <CardTitle className="font-serif text-lg flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-accent" />
            My Courses
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (fetchError) return (
    <Card className="mb-10">
      <CardHeader>
        <CardTitle className="font-serif text-lg flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-accent" />
          My Courses
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-destructive py-4 text-center">
          Could not load your courses. Please try refreshing the page.
        </p>
      </CardContent>
    </Card>
  )

  if (filtered.length === 0) return (
    <Card className="mb-10">
      <CardHeader>
        <CardTitle className="font-serif text-lg flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-accent" />
          My Courses
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground py-4 text-center">
          You haven't enrolled in any courses yet. Browse the catalog below to get started.
        </p>
      </CardContent>
    </Card>
  )

  return (
    <Card className="mb-10">
      <CardHeader>
        <CardTitle className="font-serif text-lg flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-accent" />
          My Courses
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {filtered.map((enrollment) => {
            const grade = grades.find((g) => g.course_id === enrollment.course_id)
            const progressColor =
              enrollment.progress >= 100
                ? "bg-success"
                : enrollment.progress >= 60
                  ? "bg-primary"
                  : enrollment.progress >= 30
                    ? "bg-warning"
                    : "bg-destructive"

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
                      <CheckCircle className="h-4 w-4 shrink-0 text-success" />
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
                      <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
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
      </CardContent>
    </Card>
  )
}

export default function HomePage() {
  const { user } = useAuth()
  const { input, setInput, value: query, maxLength } = useDebouncedSearchParam()
  const [courses, setCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    const signal = { cancelled: false }
    setLoading(true)
    setError(null)
    coursesService
      .getCourses(query || undefined)
      .then((data) => {
        if (!signal.cancelled) setCourses(data)
      })
      .catch(() => {
        if (!signal.cancelled) setError("Failed to load courses. Please try again later.")
      })
      .finally(() => {
        if (!signal.cancelled) setLoading(false)
      })
    return () => { signal.cancelled = true }
  }, [query, reloadKey])

  return (
    <div className="container mx-auto px-4 py-10">
      {user && <MyCoursesSection />}

      <div className="max-w-2xl mx-auto text-center mb-12">
        <p className="text-xs uppercase tracking-[0.2em] text-accent font-medium mb-3">Academic Programs</p>
        <h1 className="font-serif text-3xl sm:text-4xl font-bold tracking-tight mb-3">
          {user ? "Browse Courses" : "Course Catalog"}
        </h1>
        <p className="text-muted-foreground text-sm mb-8">
          {user
            ? "Discover more courses to expand your knowledge"
            : "Browse our seminary courses and deepen your biblical knowledge"}
        </p>
        <div className="relative max-w-md mx-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value.slice(0, maxLength))}
            maxLength={maxLength}
            placeholder="Search courses..."
            className="pl-9 rounded-md"
            aria-label="Search courses"
          />
        </div>
      </div>

      {!user && (
        <div className="mb-8 flex items-center justify-center gap-2 rounded-md border border-border border-l-[3px] border-l-info bg-info/5 px-4 py-3">
          <LogIn className="h-4 w-4 text-info" />
          <p className="text-sm text-foreground">
            <Link
              to="/login"
              className="font-medium underline underline-offset-2 hover:no-underline"
            >
              Sign in
            </Link>{" "}
            to enroll in courses
          </p>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-7">
          {Array.from({ length: 6 }).map((_, i) => <CourseCardSkeleton key={i} />)}
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <BookOpen className="h-12 w-12 text-destructive/40 mb-4" />
          <h3 className="font-serif text-lg font-medium mb-1">Something went wrong</h3>
          <p className="text-sm text-muted-foreground mb-4">{error}</p>
          <button
            onClick={() => setReloadKey((k) => k + 1)}
            className="text-sm text-primary hover:underline"
          >
            Try again
          </button>
        </div>
      ) : courses.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <BookOpen className="h-12 w-12 text-muted-foreground/30 mb-4" />
          <h3 className="font-serif text-lg font-medium mb-1">
            {query ? "No courses found" : "No courses yet"}
          </h3>
          <p className="text-sm text-muted-foreground">
            {query
              ? "Try a different search term"
              : "Check back soon for new courses"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-7">
          {courses.map((course) => (
            <CourseCard key={course.id} course={course} />
          ))}
        </div>
      )}
    </div>
  )
}
