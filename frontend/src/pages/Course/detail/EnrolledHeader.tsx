import { Link } from "react-router-dom"
import {
  ArrowLeft,
  BookOpen,
  CalendarDays,
  CheckCircle,
  Layers,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { toProxyImage } from "@/lib/images"
import type { Cohort, Course, Enrollment } from "@/types"

interface Props {
  course: Course
  enrollment: Enrollment
  enrolledCohort: Cohort | undefined
  moduleCount: number
  chapterCount: number
}

export function EnrolledHeader({
  course,
  enrollment,
  enrolledCohort,
  moduleCount,
  chapterCount,
}: Props) {
  return (
    <>
      <Link to="/">
        <Button variant="ghost" size="sm" className="mb-4 h-8 text-xs">
          <ArrowLeft className="mr-1.5 h-4 w-4" strokeWidth={1.75} aria-hidden />
          All Courses
        </Button>
      </Link>

      <div className="flex flex-col sm:flex-row gap-4 mb-5">
        {course.image_url && (
          <div className="h-24 w-full shrink-0 overflow-hidden rounded-md bg-muted sm:w-36">
            <img
              src={toProxyImage(course.image_url)}
              alt={course.title}
              loading="lazy"
              className="w-full h-full object-cover"
              onError={(e) => {
                ;(e.currentTarget.parentElement as HTMLElement).style.display = "none"
              }}
            />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h1 className="mb-1 font-serif text-xl font-bold tracking-tight text-wrap-safe sm:text-2xl">
            {course.title}
          </h1>
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            {enrolledCohort && (
              <span className="flex items-center gap-1 font-medium text-primary">
                <CalendarDays className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden />
                {enrolledCohort.name}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Layers className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden />
              {moduleCount} modules
            </span>
            <span className="flex items-center gap-1">
              <BookOpen className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden />
              {chapterCount} chapters
            </span>
            <span className="flex items-center gap-1 font-medium text-success">
              <CheckCircle className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden />
              {enrollment.progress}% complete
            </span>
          </div>
        </div>
      </div>
    </>
  )
}
