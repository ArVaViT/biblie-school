import { useEffect, useState, useMemo } from "react"
import { useParams, Link } from "react-router-dom"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { coursesService } from "@/services/courses"
import { toast } from "@/hooks/use-toast"
import { getErrorDetail } from "@/lib/errorDetail"
import {
  ArrowLeft,
  Users,
  TrendingUp,
  Award,
  Search,
  ChevronDown,
  ChevronRight,
  BookOpen,
  CheckCircle,
  XCircle,
  Clock,
  ClipboardList,
  BarChart3,
  FileText,
  RotateCcw,
  Loader2,
} from "lucide-react"

interface QuizResult {
  chapter_title: string
  chapter_id: string
  quiz_id?: string
  score: number
  max_score: number
  passed: boolean
  attempts_used?: number
}

interface AssignmentResult {
  chapter_title: string
  chapter_id: string
  title: string
  status: string
  grade: number | null
  max_score: number
}

interface ChapterInfo {
  id: string
  title: string
  chapter_type: string
  requires_completion: boolean
  completed: boolean
  completed_by: "teacher" | "self" | "quiz" | null
}

interface StudentData {
  id: string
  full_name: string
  email: string
  enrolled_at: string
  progress: number
  chapters_completed: number
  total_chapters: number
  quiz_results: QuizResult[]
  assignment_results: AssignmentResult[]
  last_activity: string | null
  chapters?: ChapterInfo[]
}

interface ProgressData {
  course_title: string
  total_chapters: number
  students: StudentData[]
  chapters?: { id: string; title: string; requires_completion: boolean }[]
}

export default function StudentProgress() {
  const { courseId } = useParams<{ courseId: string }>()
  const [data, setData] = useState<ProgressData | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<"name" | "progress" | "last_activity">("name")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc")

  useEffect(() => {
    if (!courseId) return
    let cancelled = false
    setLoading(true)
    setData(null)
    const load = async () => {
      try {
        const result = await coursesService.getStudentProgress(courseId)
        if (!cancelled) setData(result)
      } catch (err) {
        if (!cancelled) toast({ title: getErrorDetail(err, "Failed to load student progress"), variant: "destructive" })
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [courseId])

  const toggleSort = (col: typeof sortBy) => {
    if (sortBy === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortBy(col)
      setSortDir("asc")
    }
  }

  const filtered = useMemo(() => {
    if (!data) return []
    let list = data.students
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(
        (s) =>
          (s.full_name ?? "").toLowerCase().includes(q) ||
          (s.email ?? "").toLowerCase().includes(q),
      )
    }
    list = [...list].sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1
      if (sortBy === "name") return a.full_name.localeCompare(b.full_name) * dir
      if (sortBy === "progress") return (a.progress - b.progress) * dir
      if (sortBy === "last_activity") {
        const da = a.last_activity ? new Date(a.last_activity).getTime() : 0
        const db = b.last_activity ? new Date(b.last_activity).getTime() : 0
        return (da - db) * dir
      }
      return 0
    })
    return list
  }, [data, search, sortBy, sortDir])

  const avgProgress = useMemo(() => {
    if (!data || data.students.length === 0) return 0
    return Math.round(
      data.students.reduce((sum, s) => sum + s.progress, 0) / data.students.length,
    )
  }, [data])

  const completionRate = useMemo(() => {
    if (!data || data.students.length === 0) return 0
    const completed = data.students.filter((s) => s.progress >= 100).length
    return Math.round((completed / data.students.length) * 100)
  }, [data])

  const quizAvg = (student: StudentData) => {
    if (student.quiz_results.length === 0) return null
    const total = student.quiz_results.reduce((s, q) => s + (q.score / q.max_score) * 100, 0)
    return Math.round(total / student.quiz_results.length)
  }

  const assignmentAvg = (student: StudentData) => {
    const graded = student.assignment_results.filter((a) => a.grade !== null)
    if (graded.length === 0) return null
    const total = graded.reduce((s, a) => s + ((a.grade! / a.max_score) * 100), 0)
    return Math.round(total / graded.length)
  }

  const overallGrade = (student: StudentData) => {
    const scores: number[] = []
    const qAvg = quizAvg(student)
    const aAvg = assignmentAvg(student)
    if (qAvg !== null) scores.push(qAvg)
    if (aAvg !== null) scores.push(aAvg)
    if (scores.length === 0) return null
    return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
  }

  const formatDate = (d: string | null) => {
    if (!d) return "—"
    return new Date(d).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  }

  const relativeTime = (d: string | null) => {
    if (!d) return "Never"
    const diff = Date.now() - new Date(d).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 60) return `${mins}m ago`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    if (days < 7) return `${days}d ago`
    return formatDate(d)
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="h-8 w-48 bg-muted rounded animate-pulse mb-6" />
        <div className="rounded-lg border">
          <div className="p-4 border-b">
            <div className="h-9 w-64 bg-muted rounded animate-pulse" />
          </div>
          <div className="divide-y">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="p-4 flex items-center gap-4">
                <div className="h-4 w-4 bg-muted rounded animate-pulse" />
                <div className="h-4 flex-1 bg-muted rounded animate-pulse" />
                <div className="h-4 w-24 bg-muted rounded animate-pulse" />
                <div className="h-4 w-16 bg-muted rounded animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-6xl text-center">
        <Users className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
        <h2 className="text-lg font-medium mb-2">Failed to load student progress</h2>
        <p className="text-sm text-muted-foreground mb-4">The server may be temporarily unavailable. Please try again.</p>
        <div className="flex justify-center gap-2">
          <Button variant="outline" onClick={() => { setLoading(true); window.location.reload() }}>
            Retry
          </Button>
          <Link to="/teacher">
            <Button variant="ghost">
              <ArrowLeft className="h-4 w-4 mr-1.5" />
              Back to courses
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  const handleStudentChapterUpdate = (studentId: string, chapterId: string, completed: boolean, completedBy: "teacher" | "self" | null) => {
    setData((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        students: prev.students.map((s) => {
          if (s.id !== studentId) return s
          const updatedChapters = s.chapters?.map((ch) =>
            ch.id === chapterId ? { ...ch, completed, completed_by: completedBy } : ch,
          )
          const completedCount = updatedChapters?.filter((ch) => ch.completed).length ?? s.chapters_completed
          return {
            ...s,
            chapters: updatedChapters,
            chapters_completed: completed ? s.chapters_completed + 1 : Math.max(0, s.chapters_completed - 1),
            progress: prev.total_chapters > 0 ? Math.round((completedCount / prev.total_chapters) * 100) : s.progress,
          }
        }),
      }
    })
  }

  const SortIndicator = ({ col }: { col: typeof sortBy }) => {
    if (sortBy !== col) return null
    return <span className="ml-1">{sortDir === "asc" ? "↑" : "↓"}</span>
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      {/* Header */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
        <Link to="/teacher" className="hover:text-foreground transition-colors">My Courses</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <Link to={`/teacher/courses/${courseId}`} className="hover:text-foreground transition-colors">{data.course_title || "Course"}</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-foreground font-medium">Student Progress</span>
      </div>
      <div className="flex items-center gap-3 mb-8">
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight">Student Progress</h1>
          <p className="text-muted-foreground mt-1">{data.course_title}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link to={`/teacher/courses/${courseId}/analytics`}>
            <Button size="sm" variant="outline">
              <BarChart3 className="h-4 w-4 mr-1.5" />
              Analytics
            </Button>
          </Link>
          <Link to={`/teacher/courses/${courseId}/gradebook`}>
            <Button size="sm" variant="outline">
              <ClipboardList className="h-4 w-4 mr-1.5" />
              Gradebook
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Students</p>
                <p className="text-2xl font-bold mt-1">{data.students.length}</p>
              </div>
              <Users className="h-8 w-8 text-blue-600 opacity-80" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Average Progress</p>
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
                <p className="text-sm text-muted-foreground">Completion Rate</p>
                <p className="text-2xl font-bold mt-1">{completionRate}%</p>
              </div>
              <Award className="h-8 w-8 text-amber-600 opacity-80" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search students by name or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Student Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5" />
            Students
            <span className="text-sm font-normal text-muted-foreground">
              ({filtered.length})
            </span>
          </CardTitle>
          <CardDescription>Click a row to view detailed breakdown</CardDescription>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">
                {search ? "No students match your search" : "No students enrolled yet"}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-3 pr-2 w-8" />
                    <th
                      className="pb-3 font-medium text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors"
                      onClick={() => toggleSort("name")}
                    >
                      Name <SortIndicator col="name" />
                    </th>
                    <th className="pb-3 font-medium text-muted-foreground">Email</th>
                    <th
                      className="pb-3 font-medium text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors"
                      onClick={() => toggleSort("progress")}
                    >
                      Progress <SortIndicator col="progress" />
                    </th>
                    <th className="pb-3 font-medium text-muted-foreground">Chapters</th>
                    <th className="pb-3 font-medium text-muted-foreground">Quiz Avg</th>
                    <th className="pb-3 font-medium text-muted-foreground">Assign. Avg</th>
                    <th
                      className="pb-3 font-medium text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors"
                      onClick={() => toggleSort("last_activity")}
                    >
                      Last Active <SortIndicator col="last_activity" />
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((student) => {
                    const isExpanded = expandedId === student.id
                    const qA = quizAvg(student)
                    const aA = assignmentAvg(student)
                    const grade = overallGrade(student)

                    return (
                      <StudentRow
                        key={student.id}
                        student={student}
                        isExpanded={isExpanded}
                        onToggle={() => setExpandedId(isExpanded ? null : student.id)}
                        quizAvg={qA}
                        assignmentAvg={aA}
                        overallGrade={grade}
                        relativeTime={relativeTime}
                        formatDate={formatDate}
                        courseId={courseId!}
                        onStudentUpdate={handleStudentChapterUpdate}
                      />
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function ProgressBar({ value, className = "" }: { value: number; className?: string }) {
  const color =
    value >= 100
      ? "bg-emerald-500"
      : value >= 60
        ? "bg-primary"
        : value >= 30
          ? "bg-amber-500"
          : "bg-red-400"

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="flex-1 h-2 rounded-full bg-muted max-w-[120px]">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${Math.min(value, 100)}%` }}
        />
      </div>
      <span className="text-xs font-medium tabular-nums w-10 text-right">
        {value}%
      </span>
    </div>
  )
}

function ScoreBadge({ value }: { value: number | null }) {
  if (value === null) return <span className="text-xs text-muted-foreground">—</span>
  const color =
    value >= 90
      ? "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 dark:text-emerald-400"
      : value >= 70
        ? "text-blue-600 bg-blue-50 dark:bg-blue-950/30 dark:text-blue-400"
        : value >= 50
          ? "text-amber-600 bg-amber-50 dark:bg-amber-950/30 dark:text-amber-400"
          : "text-red-600 bg-red-50 dark:bg-red-950/30 dark:text-red-400"
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>
      {value}%
    </span>
  )
}

interface StudentRowProps {
  student: StudentData
  isExpanded: boolean
  onToggle: () => void
  quizAvg: number | null
  assignmentAvg: number | null
  overallGrade: number | null
  relativeTime: (d: string | null) => string
  formatDate: (d: string | null) => string
  courseId: string
  onStudentUpdate: (studentId: string, chapterId: string, completed: boolean, completedBy: "teacher" | "self" | null) => void
}

function StudentRow({
  student,
  isExpanded,
  onToggle,
  quizAvg: qA,
  assignmentAvg: aA,
  overallGrade: grade,
  relativeTime,
  formatDate,
  courseId,
  onStudentUpdate,
}: StudentRowProps) {
  const [togglingChapter, setTogglingChapter] = useState<string | null>(null)
  const [grantingQuiz, setGrantingQuiz] = useState<string | null>(null)

  const allChapters = new Map<string, { quiz?: QuizResult; assignment?: AssignmentResult; chapterInfo?: ChapterInfo }>()

  student.chapters?.forEach((ch) => {
    const existing = allChapters.get(ch.title) || {}
    allChapters.set(ch.title, { ...existing, chapterInfo: ch })
  })
  student.quiz_results.forEach((q) => {
    const existing = allChapters.get(q.chapter_title) || {}
    allChapters.set(q.chapter_title, { ...existing, quiz: q })
  })
  student.assignment_results.forEach((a) => {
    const existing = allChapters.get(a.chapter_title) || {}
    allChapters.set(a.chapter_title, { ...existing, assignment: a })
  })

  const handleToggleComplete = async (chapterInfo: ChapterInfo) => {
    setTogglingChapter(chapterInfo.id)
    try {
      if (chapterInfo.completed) {
        await coursesService.teacherMarkIncomplete(chapterInfo.id, student.id)
        onStudentUpdate(student.id, chapterInfo.id, false, null)
        toast({ title: "Marked as incomplete", variant: "success" })
      } else {
        await coursesService.teacherMarkComplete(chapterInfo.id, student.id)
        onStudentUpdate(student.id, chapterInfo.id, true, "teacher")
        toast({ title: "Marked as complete", variant: "success" })
      }
    } catch {
      toast({ title: "Failed to update completion", variant: "destructive" })
    } finally {
      setTogglingChapter(null)
    }
  }

  const handleGrantExtraAttempt = async (quizId: string) => {
    setGrantingQuiz(quizId)
    try {
      await coursesService.grantExtraAttempts(quizId, student.id, 1)
      toast({ title: "Extra attempt granted", variant: "success" })
    } catch {
      toast({ title: "Failed to grant extra attempt", variant: "destructive" })
    } finally {
      setGrantingQuiz(null)
    }
  }

  return (
    <>
      <tr
        className="border-b last:border-0 cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={onToggle}
      >
        <td className="py-3 pr-2">
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </td>
        <td className="py-3 font-medium">{student.full_name}</td>
        <td className="py-3 text-muted-foreground">{student.email}</td>
        <td className="py-3">
          <ProgressBar value={student.progress} />
        </td>
        <td className="py-3 text-center tabular-nums">
          {student.chapters_completed}/{student.total_chapters}
        </td>
        <td className="py-3">
          <ScoreBadge value={qA} />
        </td>
        <td className="py-3">
          <ScoreBadge value={aA} />
        </td>
        <td className="py-3 text-muted-foreground text-xs">
          {relativeTime(student.last_activity)}
        </td>
      </tr>
      {isExpanded && (
        <tr>
          <td colSpan={8} className="p-0">
            <div className="bg-muted/30 border-y px-6 py-5 space-y-5">
              {/* Summary row */}
              <div className="flex flex-wrap gap-6">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Overall Grade</p>
                  <p className="text-xl font-bold">
                    {grade !== null ? `${grade}%` : "N/A"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Enrolled</p>
                  <p className="text-sm font-medium">{formatDate(student.enrolled_at)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Chapters Completed</p>
                  <p className="text-sm font-medium">
                    {student.chapters_completed} of {student.total_chapters}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Progress</p>
                  <ProgressBar value={student.progress} />
                </div>
              </div>

              {/* Chapter breakdown */}
              {allChapters.size > 0 && (
                <div>
                  <h4 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
                    <BookOpen className="h-4 w-4" />
                    Chapter Breakdown
                  </h4>
                  <div className="space-y-2">
                    {Array.from(allChapters.entries()).map(([title, { quiz, assignment, chapterInfo }]) => (
                      <div
                        key={title}
                        className="flex items-center gap-4 bg-background rounded-lg px-4 py-3 border text-sm"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium truncate">{title}</p>
                          </div>
                          {chapterInfo && ["quiz", "exam", "assignment"].includes(chapterInfo.chapter_type) && (
                            <p className="text-xs mt-0.5">
                              {chapterInfo.completed ? (
                                <span className={chapterInfo.completed_by === "teacher"
                                  ? "text-blue-600 dark:text-blue-400"
                                  : "text-emerald-600 dark:text-emerald-400"
                                }>
                                  {chapterInfo.completed_by === "teacher"
                                    ? "Completed by teacher"
                                    : chapterInfo.completed_by === "quiz"
                                      ? "Completed via quiz"
                                      : "Completed via submission"}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">Not completed</span>
                              )}
                            </p>
                          )}
                        </div>
                        {quiz && (
                          <div className="flex items-center gap-1.5 text-xs">
                            {quiz.passed ? (
                              <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                            ) : (
                              <XCircle className="h-3.5 w-3.5 text-red-500" />
                            )}
                            <span>
                              Quiz: {quiz.score}/{quiz.max_score}
                            </span>
                            {quiz.quiz_id && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 px-1.5 text-[10px] text-muted-foreground hover:text-foreground"
                                disabled={grantingQuiz === quiz.quiz_id}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleGrantExtraAttempt(quiz.quiz_id!)
                                }}
                                title="Grant extra attempt"
                              >
                                {grantingQuiz === quiz.quiz_id ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <RotateCcw className="h-3 w-3" />
                                )}
                              </Button>
                            )}
                          </div>
                        )}
                        {assignment && (
                          <div className="flex items-center gap-1.5 text-xs">
                            {assignment.status === "graded" ? (
                              <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                            ) : (
                              <Clock className="h-3.5 w-3.5 text-amber-500" />
                            )}
                            <span>
                              {assignment.title}:{" "}
                              {assignment.grade !== null
                                ? `${assignment.grade}/${assignment.max_score}`
                                : assignment.status}
                            </span>
                          </div>
                        )}
                        {chapterInfo && ["quiz", "exam", "assignment"].includes(chapterInfo.chapter_type) && (
                          <Button
                            variant={chapterInfo.completed ? "outline" : "default"}
                            size="sm"
                            className="shrink-0 text-xs h-7"
                            disabled={togglingChapter === chapterInfo.id}
                            onClick={(e) => {
                              e.stopPropagation()
                              handleToggleComplete(chapterInfo)
                            }}
                          >
                            {togglingChapter === chapterInfo.id ? (
                              <Clock className="h-3 w-3 mr-1 animate-spin" />
                            ) : chapterInfo.completed ? (
                              <XCircle className="h-3 w-3 mr-1" />
                            ) : (
                              <CheckCircle className="h-3 w-3 mr-1" />
                            )}
                            {chapterInfo.completed ? "Undo" : "Complete"}
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-2 pt-1">
                <Link to={`/teacher/courses/${courseId}/gradebook`}>
                  <Button size="sm" variant="outline">
                    <ClipboardList className="h-3.5 w-3.5 mr-1.5" />
                    Gradebook
                  </Button>
                </Link>
                <Link to={`/teacher/courses/${courseId}/analytics`}>
                  <Button size="sm" variant="ghost">
                    <FileText className="h-3.5 w-3.5 mr-1.5" />
                    View Analytics
                  </Button>
                </Link>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}
