import { useEffect, useState, useCallback } from "react"
import { Link } from "react-router-dom"
import { Input } from "@/components/ui/input"
import { coursesService } from "@/services/courses"
import type { Course } from "@/types"
import { useAuth } from "@/context/AuthContext"
import CourseCard from "@/components/course/CourseCard"
import CourseCardSkeleton from "@/components/skeletons/CourseCardSkeleton"
import { Search, BookOpen, LogIn } from "lucide-react"

export default function HomePage() {
  const { user } = useAuth()
  const [courses, setCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(timer)
  }, [search])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await coursesService.getCourses(debouncedSearch || undefined)
      setCourses(data)
    } catch {
      setError("Failed to load courses. Please try again later.")
    } finally {
      setLoading(false)
    }
  }, [debouncedSearch])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div className="container mx-auto px-4 py-10">
      <div className="max-w-2xl mx-auto text-center mb-12">
        <p className="text-xs uppercase tracking-[0.2em] text-accent font-medium mb-3">Academic Programs</p>
        <h1 className="font-serif text-3xl sm:text-4xl font-bold tracking-tight mb-3">Course Catalog</h1>
        <p className="text-muted-foreground text-sm mb-8">
          Browse our seminary courses and deepen your biblical knowledge
        </p>
        <div className="relative max-w-md mx-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search courses..."
            className="pl-9 rounded-md"
          />
        </div>
      </div>

      {!user && (
        <div className="mb-8 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 px-4 py-3 flex items-center justify-center gap-2">
          <LogIn className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <p className="text-sm text-blue-800 dark:text-blue-300">
            <Link to="/login" className="font-medium underline underline-offset-2 hover:text-blue-900 dark:hover:text-blue-200">Sign in</Link> to enroll in courses
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
            onClick={load}
            className="text-sm text-primary hover:underline"
          >
            Try again
          </button>
        </div>
      ) : courses.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <BookOpen className="h-12 w-12 text-muted-foreground/30 mb-4" />
          <h3 className="font-serif text-lg font-medium mb-1">
            {debouncedSearch ? "No courses found" : "No courses yet"}
          </h3>
          <p className="text-sm text-muted-foreground">
            {debouncedSearch
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
