import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { coursesService } from "@/services/courses"
import { useAuth } from "@/context/AuthContext"
import type { Enrollment } from "@/types"
import DashboardSkeleton from "@/components/skeletons/DashboardSkeleton"
import { BookOpen, GraduationCap, BookOpenCheck, ArrowRight } from "lucide-react"

export default function Dashboard() {
  const { user } = useAuth()
  const [enrollments, setEnrollments] = useState<Enrollment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await coursesService.getMyCourses()
      setEnrollments(data)
    } catch (err) {
      console.error("Failed to load courses:", err)
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

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
            <RoleIcon className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Welcome back, {user?.full_name?.split(" ")[0] || "there"}
            </h1>
            <p className="text-sm text-muted-foreground capitalize">{user?.role} dashboard</p>
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
            <BookOpen className="h-5 w-5" />
            <CardTitle className="text-lg">My Courses</CardTitle>
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
          ) : enrollments.length === 0 ? (
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
              {enrollments.map((enrollment) => (
                <div
                  key={enrollment.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <h3 className="font-medium text-sm truncate">
                      {enrollment.course?.title || "Course"}
                    </h3>
                    <div className="flex items-center gap-2 mt-2">
                      <div className="h-1.5 w-24 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all duration-500"
                          style={{ width: `${enrollment.progress}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {enrollment.progress}%
                      </span>
                    </div>
                  </div>
                  {enrollment.course && (
                    <Link to={`/courses/${enrollment.course.id}`}>
                      <Button variant="ghost" size="sm" className="h-8 text-xs shrink-0 ml-4">
                        Continue
                        <ArrowRight className="h-3.5 w-3.5 ml-1" />
                      </Button>
                    </Link>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
