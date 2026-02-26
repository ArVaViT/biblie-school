import { useEffect, useState } from "react"
import { useParams, Link } from "react-router-dom"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { coursesService } from "@/services/courses"
import { authService } from "@/services/auth"
import type { Course } from "@/types"
import { BookOpen, Play, ArrowRight } from "lucide-react"

export default function CourseDetail() {
  const { id } = useParams<{ id: string }>()
  const [course, setCourse] = useState<Course | null>(null)
  const [loading, setLoading] = useState(true)
  const [enrolling, setEnrolling] = useState(false)

  useEffect(() => {
    const load = async () => {
      if (!id) return
      try {
        setCourse(await coursesService.getCourse(id))
      } catch (error) {
        console.error("Failed to load course:", error)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  const handleEnroll = async () => {
    if (!id || !authService.isAuthenticated()) return
    setEnrolling(true)
    try {
      await coursesService.enrollInCourse(id)
      setCourse(await coursesService.getCourse(id))
    } catch (error) {
      console.error("Failed to enroll:", error)
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

  if (!course) {
    return (
      <div className="container mx-auto px-4 py-20 text-center">
        <BookOpen className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
        <h2 className="text-lg font-medium">Course not found</h2>
      </div>
    )
  }

  const sortedModules = [...(course.modules ?? [])].sort(
    (a, b) => a.order_index - b.order_index,
  )

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {course.image_url && (
        <div className="w-full h-56 sm:h-72 mb-8 overflow-hidden rounded-xl">
          <img
            src={course.image_url}
            alt={course.title}
            className="w-full h-full object-cover"
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
        {authService.isAuthenticated() && (
          <Button onClick={handleEnroll} disabled={enrolling} className="mt-6">
            {enrolling ? "Enrolling..." : "Enroll in Course"}
          </Button>
        )}
      </div>

      <div>
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <BookOpen className="h-5 w-5" />
          Course Modules
          <span className="text-sm font-normal text-muted-foreground ml-1">
            ({sortedModules.length})
          </span>
        </h2>

        {sortedModules.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {sortedModules.map((module, idx) => (
              <Card key={module.id} className="group hover:shadow-md transition-all">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <span className="flex items-center justify-center h-6 w-6 rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0">
                      {idx + 1}
                    </span>
                    {module.title}
                  </CardTitle>
                  {module.description && (
                    <CardDescription className="text-xs ml-8">
                      {module.description}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent className="pt-0">
                  <Link to={`/courses/${id}/modules/${module.id}`}>
                    <Button variant="ghost" size="sm" className="ml-8 h-8 text-xs group/btn">
                      <Play className="h-3.5 w-3.5 mr-1" />
                      Open Module
                      <ArrowRight className="h-3.5 w-3.5 ml-1 transition-transform group-hover/btn:translate-x-0.5" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center text-muted-foreground text-sm">
              No modules added yet
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
