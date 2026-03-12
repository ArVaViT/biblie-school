import { useEffect, useState, useCallback } from "react"
import { useParams, Link } from "react-router-dom"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { coursesService } from "@/services/courses"
import { supabase } from "@/lib/supabase"
import type { StudentGrade } from "@/types"
import {
  ArrowLeft, Save, Users, Award, MessageSquare,
  ChevronDown, ChevronRight, TrendingUp,
} from "lucide-react"

interface EnrolledStudent {
  user_id: string
  progress: number
  enrolled_at: string
  full_name: string | null
  email: string
}

interface GradeForm {
  grade: string
  comment: string
}

export default function TeacherGradebook() {
  const { courseId } = useParams<{ courseId: string }>()
  const [courseTitle, setCourseTitle] = useState("")
  const [students, setStudents] = useState<EnrolledStudent[]>([])
  const [grades, setGrades] = useState<Map<string, StudentGrade>>(new Map())
  const [forms, setForms] = useState<Map<string, GradeForm>>(new Map())
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [saving, setSaving] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!courseId) return
    setLoading(true)
    setError(null)
    try {
      const [course, analytics] = await Promise.all([
        coursesService.getCourse(courseId),
        coursesService.getCourseAnalytics(courseId),
      ])
      setCourseTitle(course.title)

      const enrolled: EnrolledStudent[] = analytics.enrollments.map((e) => ({
        user_id: e.user_id,
        progress: e.progress,
        enrolled_at: e.enrolled_at,
        full_name: e.student?.full_name ?? null,
        email: e.student?.email ?? "",
      }))
      setStudents(enrolled)

      const studentIds = enrolled.map((s) => s.user_id)
      if (studentIds.length > 0) {
        const { data } = await supabase
          .from("student_grades")
          .select("*")
          .eq("course_id", courseId)
          .in("student_id", studentIds)

        const gradeMap = new Map<string, StudentGrade>()
        const formMap = new Map<string, GradeForm>()
        for (const g of data ?? []) {
          gradeMap.set(g.student_id, g)
          formMap.set(g.student_id, { grade: g.grade ?? "", comment: g.comment ?? "" })
        }
        setGrades(gradeMap)
        setForms(formMap)
      }
    } catch (err) {
      console.error("Failed to load gradebook:", err)
      setError("Failed to load gradebook. Please try again.")
    } finally {
      setLoading(false)
    }
  }, [courseId])

  useEffect(() => { load() }, [load])

  const toggleExpand = (userId: string) => {
    if (expandedId === userId) {
      setExpandedId(null)
    } else {
      setExpandedId(userId)
      if (!forms.has(userId)) {
        setForms((prev) => new Map(prev).set(userId, { grade: "", comment: "" }))
      }
    }
  }

  const updateForm = (userId: string, field: keyof GradeForm, value: string) => {
    setForms((prev) => {
      const next = new Map(prev)
      const current = next.get(userId) ?? { grade: "", comment: "" }
      next.set(userId, { ...current, [field]: value })
      return next
    })
  }

  const saveGrade = async (userId: string) => {
    if (!courseId) return
    setSaving(userId)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const form = forms.get(userId) ?? { grade: "", comment: "" }
      const { data, error } = await supabase
        .from("student_grades")
        .upsert(
          {
            student_id: userId,
            course_id: courseId,
            grade: form.grade.trim() || null,
            comment: form.comment.trim() || null,
            graded_by: session.user.id,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "student_id,course_id" },
        )
        .select()
        .single()

      if (error) throw error
      setGrades((prev) => new Map(prev).set(userId, data))
    } catch (err) {
      console.error("Failed to save grade:", err)
    } finally {
      setSaving(null)
    }
  }

  const avgProgress = students.length > 0
    ? Math.round(students.reduce((sum, s) => sum + s.progress, 0) / students.length)
    : 0

  const gradedCount = grades.size

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Award className="h-12 w-12 text-destructive/40 mb-4" />
          <h3 className="text-lg font-medium mb-1">Something went wrong</h3>
          <p className="text-sm text-muted-foreground mb-4">{error}</p>
          <div className="flex gap-3">
            <Button onClick={load} size="sm" variant="outline">
              Try again
            </Button>
            <Link to="/teacher">
              <Button size="sm" variant="ghost">
                <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
                Back to courses
              </Button>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <div className="flex items-center gap-3 mb-8">
        <Link to={`/teacher/courses/${courseId}/analytics`}>
          <Button variant="ghost" size="icon" className="shrink-0">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Award className="h-7 w-7 text-primary" />
            Gradebook
          </h1>
          {courseTitle && <p className="text-muted-foreground mt-1">{courseTitle}</p>}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Students</p>
                <p className="text-2xl font-bold mt-1">{students.length}</p>
              </div>
              <Users className="h-8 w-8 text-blue-600 opacity-80" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Avg Progress</p>
                <p className="text-2xl font-bold mt-1">{avgProgress}%</p>
              </div>
              <TrendingUp className="h-8 w-8 text-emerald-600 opacity-80" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Graded</p>
                <p className="text-2xl font-bold mt-1">{gradedCount} / {students.length}</p>
              </div>
              <Award className="h-8 w-8 text-amber-600 opacity-80" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Student list */}
      <Card>
        <CardHeader>
          <CardTitle>Student Grades</CardTitle>
          <CardDescription>
            Click on a student to view details and assign a grade
          </CardDescription>
        </CardHeader>
        <CardContent>
          {students.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No students enrolled yet.
            </p>
          ) : (
            <div className="space-y-2">
              {students.map((student) => {
                const isExpanded = expandedId === student.user_id
                const existingGrade = grades.get(student.user_id)
                const form = forms.get(student.user_id) ?? { grade: "", comment: "" }

                return (
                  <div key={student.user_id} className="border rounded-lg overflow-hidden">
                    <div
                      className="flex items-center gap-3 p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => toggleExpand(student.user_id)}
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">
                            {student.full_name || "Unknown"}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {student.email}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 shrink-0">
                        <div className="flex items-center gap-2">
                          <div className="w-20 h-2 rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full rounded-full bg-primary transition-all"
                              style={{ width: `${Math.min(student.progress, 100)}%` }}
                            />
                          </div>
                          <span className="text-xs font-medium tabular-nums w-10 text-right">
                            {student.progress}%
                          </span>
                        </div>
                        {existingGrade?.grade && (
                          <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold bg-primary/10 text-primary">
                            {existingGrade.grade}
                          </span>
                        )}
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="border-t px-4 py-4 bg-muted/20 space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">Enrolled:</span>{" "}
                            <span className="font-medium">
                              {new Date(student.enrolled_at).toLocaleDateString()}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Progress:</span>{" "}
                            <span className="font-medium">{student.progress}%</span>
                          </div>
                          {existingGrade && (
                            <div>
                              <span className="text-muted-foreground">Last graded:</span>{" "}
                              <span className="font-medium">
                                {new Date(existingGrade.updated_at).toLocaleDateString()}
                              </span>
                            </div>
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-[120px_1fr] gap-3">
                          <div className="space-y-1.5">
                            <label className="text-xs font-medium flex items-center gap-1">
                              <Award className="h-3 w-3" /> Grade
                            </label>
                            <Input
                              value={form.grade}
                              onChange={(e) => updateForm(student.user_id, "grade", e.target.value)}
                              placeholder="A, B+, 95..."
                              className="h-9"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-xs font-medium flex items-center gap-1">
                              <MessageSquare className="h-3 w-3" /> Comment
                            </label>
                            <Input
                              value={form.comment}
                              onChange={(e) => updateForm(student.user_id, "comment", e.target.value)}
                              placeholder="Teacher's note about this student..."
                              className="h-9"
                            />
                          </div>
                        </div>

                        <Button
                          size="sm"
                          onClick={() => saveGrade(student.user_id)}
                          disabled={saving === student.user_id}
                        >
                          <Save className="h-3.5 w-3.5 mr-1.5" />
                          {saving === student.user_id ? "Saving..." : "Save Grade"}
                        </Button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
