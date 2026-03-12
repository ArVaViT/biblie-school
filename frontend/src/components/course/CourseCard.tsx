import { useState } from "react"
import { Link } from "react-router-dom"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import type { Course } from "@/types"
import { BookOpen, ArrowRight } from "lucide-react"

interface CourseCardProps {
  course: Course
}

function EnrollmentBadge({ start, end }: { start?: string | null; end?: string | null }) {
  if (!start && !end) return null
  const now = new Date()
  const s = start ? new Date(start) : null
  const e = end ? new Date(end) : null
  if (s && now < s) {
    return (
      <span className="absolute top-2 right-2 z-10 text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400 shadow-sm">
        Enrollment opens {s.toLocaleDateString()}
      </span>
    )
  }
  if (e && now > e) {
    return (
      <span className="absolute top-2 right-2 z-10 text-[10px] font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400 shadow-sm">
        Enrollment closed
      </span>
    )
  }
  return (
    <span className="absolute top-2 right-2 z-10 text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 shadow-sm">
      Enrolling now
    </span>
  )
}

export default function CourseCard({ course }: CourseCardProps) {
  const [imgError, setImgError] = useState(false)

  return (
    <Card className="group flex flex-col overflow-hidden border-border/60 shadow-sm hover:shadow-md transition-shadow duration-300">
      <div className="relative">
        <EnrollmentBadge start={course.enrollment_start} end={course.enrollment_end} />
        {course.image_url && !imgError ? (
          <div className="w-full h-44 overflow-hidden bg-muted">
            <img
              src={course.image_url}
              alt={course.title}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
              onError={() => setImgError(true)}
            />
          </div>
        ) : (
          <div className="w-full h-44 bg-muted flex items-center justify-center">
            <BookOpen className="h-10 w-10 text-muted-foreground/20" />
          </div>
        )}
      </div>
      <CardHeader className="pb-2">
        <CardTitle className="font-serif text-lg line-clamp-1">{course.title}</CardTitle>
        {course.description && (
          <CardDescription className="line-clamp-2 text-xs leading-relaxed">
            {course.description}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className="mt-auto pt-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground tracking-wide uppercase">
            {course.modules?.length ?? 0} modules
          </span>
          <Link to={`/courses/${course.id}`}>
            <Button size="sm" variant="ghost" className="h-8 text-xs rounded-md group/btn">
              Open
              <ArrowRight className="h-3.5 w-3.5 ml-1 transition-transform group-hover/btn:translate-x-0.5" />
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}
