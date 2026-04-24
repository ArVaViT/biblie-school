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
          <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
          All Courses
        </Button>
      </Link>

      <div className="flex flex-col sm:flex-row gap-4 mb-5">
        {course.image_url && (
          <div className="w-full sm:w-36 h-24 overflow-hidden rounded-lg bg-muted shrink-0">
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
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight mb-1 text-wrap-safe">
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
              {moduleCount} modules
            </span>
            <span className="flex items-center gap-1">
              <BookOpen className="h-3.5 w-3.5" />
              {chapterCount} chapters
            </span>
            <span className="flex items-center gap-1 font-medium text-success">
              <CheckCircle className="h-3.5 w-3.5" />
              {enrollment.progress}% complete
            </span>
          </div>
        </div>
      </div>
    </>
  )
}
