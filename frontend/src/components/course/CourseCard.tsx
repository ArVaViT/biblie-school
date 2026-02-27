import { Link } from "react-router-dom"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import type { Course } from "@/types"
import { BookOpen, ArrowRight } from "lucide-react"

interface CourseCardProps {
  course: Course
}

export default function CourseCard({ course }: CourseCardProps) {
  return (
    <Card className="group flex flex-col overflow-hidden hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5">
      {course.image_url ? (
        <div className="w-full h-44 overflow-hidden bg-muted">
          <img
            src={course.image_url}
            alt={course.title}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            onError={(e) => {
              const parent = e.currentTarget.parentElement as HTMLElement
              e.currentTarget.remove()
              parent.classList.add("flex", "items-center", "justify-center")
              const icon = document.createElement("div")
              icon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="text-muted-foreground/30"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>`
              parent.appendChild(icon)
            }}
          />
        </div>
      ) : (
        <div className="w-full h-44 bg-muted flex items-center justify-center">
          <BookOpen className="h-10 w-10 text-muted-foreground/30" />
        </div>
      )}
      <CardHeader className="pb-2">
        <CardTitle className="text-lg line-clamp-1">{course.title}</CardTitle>
        {course.description && (
          <CardDescription className="line-clamp-2 text-xs">
            {course.description}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className="mt-auto pt-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {course.modules?.length ?? 0} modules
          </span>
          <Link to={`/courses/${course.id}`}>
            <Button size="sm" variant="ghost" className="h-8 text-xs group/btn">
              Open
              <ArrowRight className="h-3.5 w-3.5 ml-1 transition-transform group-hover/btn:translate-x-0.5" />
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}
