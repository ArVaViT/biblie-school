import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
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
import { EmptyState, ErrorState } from "@/components/patterns"

function MyCoursesSection() {
  const { t } = useTranslation()
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
            {t("home.myCourses")}
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
          {t("home.myCourses")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-destructive py-4 text-center">
          {t("home.loadCoursesError")}
        </p>
      </CardContent>
    </Card>
  )

  if (filtered.length === 0) return (
    <Card className="mb-10">
      <CardHeader>
        <CardTitle className="font-serif text-lg flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-accent" />
          {t("home.myCourses")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground py-4 text-center">
          {t("home.noEnrollments")}
        </p>
      </CardContent>
    </Card>
  )

  return (
    <Card className="mb-10">
      <CardHeader>
        <CardTitle className="font-serif text-lg flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-accent" />
          {t("home.myCourses")}
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
                      {enrollment.course?.title || t("home.course")}
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
                        {t("home.grade", { grade: grade.grade })}
                      </span>
                    )}
                  </div>
                </div>
                {enrollment.course && (
                  <Link to={`/courses/${enrollment.course.id}`}>
                    <Button variant="ghost" size="sm" className="h-8 text-xs shrink-0 ml-4">
                      {enrollment.progress >= 100 ? t("common.view") : t("common.continue")}
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
  const { t } = useTranslation()
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
        if (!signal.cancelled) setError(t("home.loadFailed"))
      })
      .finally(() => {
        if (!signal.cancelled) setLoading(false)
      })
    return () => { signal.cancelled = true }
  }, [query, reloadKey, t])

  return (
    <div className="container mx-auto px-4 py-10">
      {user && <MyCoursesSection />}

      <div className="max-w-2xl mx-auto text-center mb-12">
        <p className="text-xs uppercase tracking-[0.2em] text-accent font-medium mb-3">{t("home.academicPrograms")}</p>
        <h1 className="font-serif text-3xl sm:text-4xl font-bold tracking-tight mb-3">
          {user ? t("home.browseCourses") : t("home.courseCatalog")}
        </h1>
        <p className="text-muted-foreground text-sm mb-8">
          {user ? t("home.discoverMore") : t("home.browseSeminary")}
        </p>
        <div className="relative max-w-md mx-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value.slice(0, maxLength))}
            maxLength={maxLength}
            placeholder={t("home.searchPlaceholder")}
            className="pl-9 rounded-md"
            aria-label={t("home.searchPlaceholder")}
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
              {t("home.signInLink")}
            </Link>{" "}
            {t("home.signInToEnroll")}
          </p>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-7">
          {Array.from({ length: 6 }).map((_, i) => <CourseCardSkeleton key={i} />)}
        </div>
      ) : error ? (
        <ErrorState
          icon={<BookOpen />}
          description={error}
          action={
            <Button variant="ghost" size="sm" onClick={() => setReloadKey((k) => k + 1)}>
              {t("common.tryAgain")}
            </Button>
          }
        />
      ) : courses.length === 0 ? (
        <EmptyState
          icon={<BookOpen />}
          title={query ? t("home.noCoursesFound") : t("home.noCoursesYet")}
          description={query ? t("home.tryDifferentSearch") : t("home.checkBackSoon")}
          className="border-none bg-transparent py-20"
        />
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
