import { useEffect, useState, useCallback, useMemo, Fragment } from "react"
import { useParams, Link } from "react-router-dom"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { coursesService } from "@/services/courses"
import type { GradingConfig, GradeSummaryResponse, StudentGrade } from "@/types"
import { toast } from "@/hooks/use-toast"
import {
  ArrowLeft, Save, Users, Award, MessageSquare,
  ChevronDown, ChevronRight, TrendingUp, Settings2,
  ArrowUpDown, ArrowUp, ArrowDown, Calculator,
  CheckCircle2, Circle, BookOpen, ClipboardList,
  HelpCircle, GraduationCap, FileText, LayoutGrid,
} from "lucide-react"

// ── Types ───────────────────────────────────────────────────────────

type SortField = "name" | "quiz" | "assignment" | "participation" | "final" | "letter"
type SortDir = "asc" | "desc"
type ActiveTab = "summary" | "table"

interface ChapterInfo {
  id: string
  title: string
  module_id: string
  chapter_type: string
  completed: boolean
  completed_by: "self" | "teacher" | null
  quiz_result: { score: number; max_score: number; passed: boolean } | null
  assignment_result: { status: string; grade: number | null; max_score?: number } | null
}

interface StudentProgressData {
  id: string
  full_name: string
  email: string
  progress: number
  chapters_completed: number
  total_chapters: number
  chapters: ChapterInfo[]
  quiz_results: Array<{ chapter_id: string; score: number; max_score: number; passed: boolean }>
  assignment_results: Array<{ chapter_id: string; status: string; grade: number | null; max_score: number }>
}

interface ModuleInfo {
  id: string
  title: string
  order_index: number
}

interface ProgressResponse {
  course_id: string
  course_title: string
  total_chapters: number
  total_students: number
  modules: ModuleInfo[]
  students: StudentProgressData[]
}

interface GradeForm {
  grade: string
  comment: string
}

// ── Helpers ─────────────────────────────────────────────────────────

const LETTER_ORDER: Record<string, number> = { A: 5, B: 4, C: 3, D: 2, F: 1 }

function letterColor(letter: string) {
  switch (letter) {
    case "A": return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
    case "B": return "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
    case "C": return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300"
    case "D": return "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300"
    case "F": return "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
    default: return "bg-muted text-muted-foreground"
  }
}

function chapterTypeIcon(type: string) {
  switch (type) {
    case "quiz": return <HelpCircle className="h-3 w-3" />
    case "exam": return <GraduationCap className="h-3 w-3" />
    case "assignment": return <ClipboardList className="h-3 w-3" />
    default: return <FileText className="h-3 w-3" />
  }
}

// ── Main Component ───────────────────────────────────────────────────

export default function TeacherGradebook() {
  const { courseId } = useParams<{ courseId: string }>()
  const [courseTitle, setCourseTitle] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<ActiveTab>("summary")

  // Grading config
  const [config, setConfig] = useState<GradingConfig>({ quiz_weight: 30, assignment_weight: 50, participation_weight: 20 })
  const [configDraft, setConfigDraft] = useState<GradingConfig>(config)
  const [configOpen, setConfigOpen] = useState(false)
  const [savingConfig, setSavingConfig] = useState(false)

  // Grade summary
  const [summary, setSummary] = useState<GradeSummaryResponse | null>(null)
  const [manualGrades, setManualGrades] = useState<Map<string, StudentGrade>>(new Map())

  // Progress data (for grade table)
  const [progressData, setProgressData] = useState<ProgressResponse | null>(null)

  // Manual grade forms
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [forms, setForms] = useState<Map<string, GradeForm>>(new Map())
  const [saving, setSaving] = useState<string | null>(null)

  // Sort state
  const [sortField, setSortField] = useState<SortField>("name")
  const [sortDir, setSortDir] = useState<SortDir>("asc")

  const load = useCallback(async (signal?: { cancelled: boolean }) => {
    if (!courseId) return
    setLoading(true)
    setError(null)
    setExpandedId(null)
    try {
      const [course, rawGrades] = await Promise.all([
        coursesService.getCourse(courseId),
        coursesService.getCourseGrades(courseId).catch(() => []),
      ])
      if (signal?.cancelled) return
      setCourseTitle(course.title)

      const gradeMap = new Map<string, StudentGrade>()
      const formMap = new Map<string, GradeForm>()
      for (const g of rawGrades ?? []) {
        gradeMap.set(g.student_id, g)
        formMap.set(g.student_id, { grade: g.grade ?? "", comment: g.comment ?? "" })
      }
      setManualGrades(gradeMap)
      setForms(formMap)

      const [gradeSummary, progress] = await Promise.allSettled([
        coursesService.getGradeSummary(courseId),
        coursesService.getStudentProgress(courseId),
      ])
      if (signal?.cancelled) return

      if (gradeSummary.status === "fulfilled") {
        setSummary(gradeSummary.value)
        setConfig(gradeSummary.value.config)
        setConfigDraft(gradeSummary.value.config)
      }

      if (progress.status === "fulfilled") {
        setProgressData(progress.value as ProgressResponse)
      }
    } catch {
      if (!signal?.cancelled) setError("Failed to load gradebook. Please try again.")
    } finally {
      if (!signal?.cancelled) setLoading(false)
    }
  }, [courseId])

  useEffect(() => {
    const signal = { cancelled: false }
    load(signal)
    return () => { signal.cancelled = true }
  }, [load])

  // ── Config save ─────────────────────────────────────────────────

  const configTotal = configDraft.quiz_weight + configDraft.assignment_weight + configDraft.participation_weight
  const configValid = configTotal === 100

  const saveConfig = async () => {
    if (!courseId || !configValid) return
    setSavingConfig(true)
    try {
      const updated = await coursesService.updateGradingConfig(courseId, configDraft)
      setConfig(updated)
      toast({ title: "Grading weights saved", variant: "success" })
      const gradeSummary = await coursesService.getGradeSummary(courseId)
      setSummary(gradeSummary)
    } catch {
      toast({ title: "Failed to save grading config", variant: "destructive" })
    } finally {
      setSavingConfig(false)
    }
  }

  // ── Manual grade ────────────────────────────────────────────────

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
      const form = forms.get(userId) ?? { grade: "", comment: "" }
      const data = await coursesService.upsertGrade(courseId, userId, {
        grade: form.grade.trim() || undefined,
        comment: form.comment.trim() || undefined,
      })
      setManualGrades((prev) => new Map(prev).set(userId, data))
      toast({ title: "Grade saved", variant: "success" })
    } catch {
      toast({ title: "Failed to save grade", variant: "destructive" })
    } finally {
      setSaving(null)
    }
  }

  // ── Sorting ─────────────────────────────────────────────────────

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortField(field)
      setSortDir(field === "name" ? "asc" : "desc")
    }
  }

  const sortedStudents = useMemo(() => {
    if (!summary) return []
    const list = [...summary.students]
    const dir = sortDir === "asc" ? 1 : -1
    list.sort((a, b) => {
      let cmp = 0
      switch (sortField) {
        case "name": cmp = (a.student_name ?? "").localeCompare(b.student_name ?? ""); break
        case "quiz": cmp = a.breakdown.quiz_avg - b.breakdown.quiz_avg; break
        case "assignment": cmp = a.breakdown.assignment_avg - b.breakdown.assignment_avg; break
        case "participation": cmp = a.breakdown.participation_pct - b.breakdown.participation_pct; break
        case "final": cmp = a.breakdown.final_score - b.breakdown.final_score; break
        case "letter": cmp = (LETTER_ORDER[a.breakdown.letter_grade] ?? 0) - (LETTER_ORDER[b.breakdown.letter_grade] ?? 0); break
      }
      return cmp * dir
    })
    return list
  }, [summary, sortField, sortDir])

  // ── Stats ───────────────────────────────────────────────────────

  const classAvg = summary?.class_average ?? 0
  const studentCount = summary?.students.length ?? 0
  const gradedCount = manualGrades.size

  // ── Sort header helper ──────────────────────────────────────────

  function SortHeader({ field, label, className }: { field: SortField; label: string; className?: string }) {
    const active = sortField === field
    return (
      <button
        onClick={() => toggleSort(field)}
        className={`flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors ${className ?? ""}`}
      >
        {label}
        {active ? (
          sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-40" />
        )}
      </button>
    )
  }

  // ── Grade Table data ────────────────────────────────────────────

  const moduleChapterMap = useMemo(() => {
    if (!progressData) return new Map<string, ChapterInfo[]>()
    const studentWithChapters = progressData.students[0]
    if (!studentWithChapters) return new Map<string, ChapterInfo[]>()
    const map = new Map<string, ChapterInfo[]>()
    for (const ch of studentWithChapters.chapters) {
      const arr = map.get(ch.module_id) ?? []
      arr.push(ch)
      map.set(ch.module_id, arr)
    }
    return map
  }, [progressData])

  const orderedModules = useMemo(() => {
    if (!progressData) return []
    return [...(progressData.modules ?? [])].sort((a, b) => a.order_index - b.order_index)
  }, [progressData])

  // Map student_id → their chapter data for fast lookup
  const studentChapterMap = useMemo(() => {
    if (!progressData) return new Map<string, Map<string, ChapterInfo>>()
    const outer = new Map<string, Map<string, ChapterInfo>>()
    for (const student of progressData.students) {
      const inner = new Map<string, ChapterInfo>()
      for (const ch of student.chapters) {
        inner.set(ch.id, ch)
      }
      outer.set(student.id, inner)
    }
    return outer
  }, [progressData])

  // Sorted students for grade table (by name)
  const tableStudents = useMemo(() => {
    if (!progressData) return []
    return [...progressData.students].sort((a, b) => (a.full_name ?? "").localeCompare(b.full_name ?? ""))
  }, [progressData])

  // ── Render ──────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Award className="h-12 w-12 text-destructive/40 mb-4" />
          <h3 className="text-lg font-medium mb-1">Something went wrong</h3>
          <p className="text-sm text-muted-foreground mb-4">{error}</p>
          <div className="flex gap-3">
            <Button onClick={() => load()} size="sm" variant="outline">Try again</Button>
            <Link to="/teacher">
              <Button size="sm" variant="ghost">
                <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />Back to courses
              </Button>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
        <Link to="/teacher" className="hover:text-foreground transition-colors">My Courses</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-foreground font-medium">Gradebook</span>
      </div>

      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Award className="h-7 w-7 text-primary" />
          Gradebook
        </h1>
        {courseTitle && <p className="text-muted-foreground mt-1">{courseTitle}</p>}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Students</p>
                <p className="text-2xl font-bold mt-0.5">{studentCount}</p>
              </div>
              <Users className="h-7 w-7 text-blue-600 opacity-70" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Class Average</p>
                <p className="text-2xl font-bold mt-0.5">{classAvg.toFixed(1)}%</p>
              </div>
              <TrendingUp className="h-7 w-7 text-emerald-600 opacity-70" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Manually Graded</p>
                <p className="text-2xl font-bold mt-0.5">{gradedCount}/{studentCount}</p>
              </div>
              <Award className="h-7 w-7 text-amber-600 opacity-70" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Weights Q/A/P</p>
                <p className="text-sm font-medium mt-0.5">
                  {config.quiz_weight}/{config.assignment_weight}/{config.participation_weight}
                </p>
              </div>
              <Calculator className="h-7 w-7 text-purple-600 opacity-70" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b">
        <button
          onClick={() => setActiveTab("summary")}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "summary"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <TrendingUp className="h-4 w-4" />
          Summary Grades
        </button>
        <button
          onClick={() => setActiveTab("table")}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "table"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <LayoutGrid className="h-4 w-4" />
          Grade Table
        </button>
      </div>

      {activeTab === "summary" && (
        <>
          {/* Grading Configuration */}
          <Card className="mb-6">
            <CardHeader
              className="cursor-pointer select-none py-4"
              onClick={() => setConfigOpen(!configOpen)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Settings2 className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <CardTitle className="text-base">Grading Configuration</CardTitle>
                    <CardDescription className="text-xs">Set how quizzes, assignments, and participation contribute to final grades</CardDescription>
                  </div>
                </div>
                {configOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
              </div>
            </CardHeader>
            {configOpen && (
              <CardContent className="border-t pt-6">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <Label>Quiz Weight (%)</Label>
                    <Input type="number" min={0} max={100} value={configDraft.quiz_weight}
                      onChange={(e) => setConfigDraft({ ...configDraft, quiz_weight: Number(e.target.value) || 0 })} className="h-9" />
                  </div>
                  <div className="space-y-2">
                    <Label>Assignment Weight (%)</Label>
                    <Input type="number" min={0} max={100} value={configDraft.assignment_weight}
                      onChange={(e) => setConfigDraft({ ...configDraft, assignment_weight: Number(e.target.value) || 0 })} className="h-9" />
                  </div>
                  <div className="space-y-2">
                    <Label>Participation Weight (%)</Label>
                    <Input type="number" min={0} max={100} value={configDraft.participation_weight}
                      onChange={(e) => setConfigDraft({ ...configDraft, participation_weight: Number(e.target.value) || 0 })} className="h-9" />
                  </div>
                </div>
                <div className="flex items-center justify-between mt-4">
                  <p className={`text-sm font-medium ${configValid ? "text-emerald-600" : "text-destructive"}`}>
                    Total: {configTotal}% {configValid ? "✓" : "(must equal 100%)"}
                  </p>
                  <Button size="sm" onClick={saveConfig} disabled={!configValid || savingConfig}>
                    <Save className="h-3.5 w-3.5 mr-1.5" />
                    {savingConfig ? "Saving..." : "Save Weights"}
                  </Button>
                </div>
              </CardContent>
            )}
          </Card>

          {/* Gradebook Table */}
          <Card>
            <CardHeader>
              <CardTitle>Student Grades</CardTitle>
              <CardDescription>
                Auto-calculated based on quiz scores, assignment grades, and chapter completion. Click a student to override manually.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {studentCount === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">No students enrolled yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <div className="grid grid-cols-[1fr_80px_80px_90px_80px_70px_70px] gap-3 px-4 py-3 border-b bg-muted/30 rounded-t-lg min-w-[700px]">
                    <SortHeader field="name" label="Student" />
                    <SortHeader field="quiz" label="Quiz" className="justify-end" />
                    <SortHeader field="assignment" label="Assign." className="justify-end" />
                    <SortHeader field="participation" label="Particip." className="justify-end" />
                    <SortHeader field="final" label="Final" className="justify-end" />
                    <SortHeader field="letter" label="Grade" className="justify-center" />
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-center">Manual</span>
                  </div>

                  <div className="divide-y min-w-[700px]">
                    {sortedStudents.map((student) => {
                      const isExpanded = expandedId === student.student_id
                      const manualGrade = manualGrades.get(student.student_id)
                      const form = forms.get(student.student_id) ?? { grade: "", comment: "" }
                      const b = student.breakdown
                      const hasDifferentManual = manualGrade?.grade && manualGrade.grade !== b.letter_grade

                      return (
                        <div key={student.student_id}>
                          <div
                            className="grid grid-cols-[1fr_80px_80px_90px_80px_70px_70px] gap-3 px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors items-center"
                            onClick={() => toggleExpand(student.student_id)}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              {isExpanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                              <div className="min-w-0">
                                <p className="text-sm font-medium truncate">{student.student_name || "Unknown"}</p>
                                <p className="text-xs text-muted-foreground truncate">{student.student_email}</p>
                              </div>
                            </div>
                            <p className="text-sm tabular-nums text-right">{b.quiz_avg.toFixed(1)}%</p>
                            <p className="text-sm tabular-nums text-right">{b.assignment_avg.toFixed(1)}%</p>
                            <p className="text-sm tabular-nums text-right">{b.participation_pct.toFixed(1)}%</p>
                            <p className="text-sm font-semibold tabular-nums text-right">{b.final_score.toFixed(1)}%</p>
                            <div className="flex justify-center">
                              <span className={`inline-flex items-center justify-center rounded-full px-2.5 py-0.5 text-xs font-bold ${letterColor(b.letter_grade)}`}>
                                {b.letter_grade}
                              </span>
                            </div>
                            <div className="flex justify-center">
                              {manualGrade?.grade ? (
                                <span className={`inline-flex items-center justify-center rounded-full px-2.5 py-0.5 text-xs font-bold ${hasDifferentManual ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 ring-1 ring-amber-300" : "bg-muted text-muted-foreground"}`}>
                                  {manualGrade.grade}
                                </span>
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </div>
                          </div>

                          {isExpanded && (
                            <div className="border-t px-4 py-4 bg-muted/10 space-y-4">
                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-2 text-sm">
                                <div>
                                  <span className="text-muted-foreground">Quiz Avg:</span>{" "}
                                  <span className="font-medium">{b.quiz_avg.toFixed(1)}%</span>
                                  <span className="text-muted-foreground text-xs ml-1">(×{config.quiz_weight}% = {b.quiz_weighted.toFixed(1)})</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Assignment Avg:</span>{" "}
                                  <span className="font-medium">{b.assignment_avg.toFixed(1)}%</span>
                                  <span className="text-muted-foreground text-xs ml-1">(×{config.assignment_weight}% = {b.assignment_weighted.toFixed(1)})</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Participation:</span>{" "}
                                  <span className="font-medium">{b.participation_pct.toFixed(1)}%</span>
                                  <span className="text-muted-foreground text-xs ml-1">(×{config.participation_weight}% = {b.participation_weighted.toFixed(1)})</span>
                                </div>
                              </div>

                              {hasDifferentManual && (
                                <div className="text-xs px-3 py-2 rounded bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                                  Manual grade <strong>{manualGrade?.grade}</strong> differs from calculated <strong>{b.letter_grade}</strong> ({b.final_score.toFixed(1)}%)
                                </div>
                              )}

                              <div className="grid grid-cols-1 sm:grid-cols-[120px_1fr] gap-3">
                                <div className="space-y-1.5">
                                  <label className="text-xs font-medium flex items-center gap-1">
                                    <Award className="h-3 w-3" /> Override Grade
                                  </label>
                                  <Input value={form.grade} onChange={(e) => updateForm(student.student_id, "grade", e.target.value)} placeholder="A, B+, 95..." className="h-9" />
                                </div>
                                <div className="space-y-1.5">
                                  <label className="text-xs font-medium flex items-center gap-1">
                                    <MessageSquare className="h-3 w-3" /> Comment
                                  </label>
                                  <Input value={form.comment} onChange={(e) => updateForm(student.student_id, "comment", e.target.value)} placeholder="Teacher's note..." className="h-9" />
                                </div>
                              </div>

                              <Button size="sm" onClick={() => saveGrade(student.student_id)} disabled={saving === student.student_id}>
                                <Save className="h-3.5 w-3.5 mr-1.5" />
                                {saving === student.student_id ? "Saving..." : "Save Manual Grade"}
                              </Button>
                            </div>
                          )}
                        </div>
                      )
                    })}

                    {studentCount > 0 && summary && (
                      <div className="grid grid-cols-[1fr_80px_80px_90px_80px_70px_70px] gap-3 px-4 py-3 bg-muted/40 font-semibold text-sm items-center border-t-2">
                        <span className="pl-6">Class Average ({studentCount} students)</span>
                        <p className="tabular-nums text-right">{(summary.students.reduce((s, st) => s + st.breakdown.quiz_avg, 0) / studentCount).toFixed(1)}%</p>
                        <p className="tabular-nums text-right">{(summary.students.reduce((s, st) => s + st.breakdown.assignment_avg, 0) / studentCount).toFixed(1)}%</p>
                        <p className="tabular-nums text-right">{(summary.students.reduce((s, st) => s + st.breakdown.participation_pct, 0) / studentCount).toFixed(1)}%</p>
                        <p className="tabular-nums text-right">{classAvg.toFixed(1)}%</p>
                        <span /><span />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {activeTab === "table" && (
        <GradeTableView
          progressData={progressData}
          orderedModules={orderedModules}
          moduleChapterMap={moduleChapterMap}
          studentChapterMap={studentChapterMap}
          tableStudents={tableStudents}
          manualGrades={manualGrades}
          forms={forms}
          saving={saving}
          updateForm={updateForm}
          saveGrade={saveGrade}
          expandedId={expandedId}
          toggleExpand={toggleExpand}
        />
      )}
    </div>
  )
}

// ── Grade Table View ─────────────────────────────────────────────────

interface GradeTableViewProps {
  progressData: ProgressResponse | null
  orderedModules: ModuleInfo[]
  moduleChapterMap: Map<string, ChapterInfo[]>
  studentChapterMap: Map<string, Map<string, ChapterInfo>>
  tableStudents: StudentProgressData[]
  manualGrades: Map<string, StudentGrade>
  forms: Map<string, GradeForm>
  saving: string | null
  updateForm: (userId: string, field: "grade" | "comment", value: string) => void
  saveGrade: (userId: string) => void
  expandedId: string | null
  toggleExpand: (userId: string) => void
}

function ChapterCell({ chapter }: { chapter: ChapterInfo | undefined }) {
  if (!chapter) {
    return <div className="flex items-center justify-center h-9 rounded bg-muted/30 text-muted-foreground/40 text-xs">—</div>
  }

  const type = chapter.chapter_type

  if (type === "quiz" || type === "exam") {
    if (chapter.quiz_result) {
      const pct = chapter.quiz_result.max_score > 0
        ? Math.round((chapter.quiz_result.score / chapter.quiz_result.max_score) * 100)
        : 0
      return (
        <div className={`flex flex-col items-center justify-center h-9 rounded text-xs font-medium px-1 ${
          chapter.quiz_result.passed
            ? "bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800"
            : "bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800"
        }`}>
          <span className="font-semibold">{pct}%</span>
          <span className="text-[10px] opacity-70">{chapter.quiz_result.score}/{chapter.quiz_result.max_score}</span>
        </div>
      )
    }
    return (
      <div className="flex items-center justify-center h-9 rounded bg-muted/30 text-muted-foreground/50 text-xs">
        <Circle className="h-3.5 w-3.5" />
      </div>
    )
  }

  if (type === "assignment") {
    if (chapter.assignment_result) {
      const graded = chapter.assignment_result.grade !== null
      return (
        <div className={`flex flex-col items-center justify-center h-9 rounded text-xs font-medium px-1 ${
          graded
            ? "bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800"
            : "bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800"
        }`}>
          {graded ? (
            <>
              <span className="font-semibold">{chapter.assignment_result.grade}pt</span>
              <span className="text-[10px] opacity-70">graded</span>
            </>
          ) : (
            <span>submitted</span>
          )}
        </div>
      )
    }
    return (
      <div className="flex items-center justify-center h-9 rounded bg-muted/30 text-muted-foreground/50 text-xs">
        <Circle className="h-3.5 w-3.5" />
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center h-9 rounded bg-muted/20 text-muted-foreground/30 text-[10px]">
      —
    </div>
  )
}

function GradeTableView({
  progressData,
  orderedModules,
  moduleChapterMap,
  studentChapterMap,
  tableStudents,
  manualGrades,
  forms,
  saving,
  updateForm,
  saveGrade,
  expandedId,
  toggleExpand,
}: GradeTableViewProps) {
  if (!progressData) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <BookOpen className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Could not load progress data.</p>
        </CardContent>
      </Card>
    )
  }

  if (tableStudents.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Users className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No students enrolled yet.</p>
        </CardContent>
      </Card>
    )
  }

  // All chapters in order (across all modules)
  const allChapters: ChapterInfo[] = orderedModules.flatMap(
    (m) => moduleChapterMap.get(m.id) ?? []
  )

  // Per-student totals
  function getStudentTotals(studentId: string) {
    const chMap = studentChapterMap.get(studentId)
    if (!chMap) return { earned: 0, total: 0 }
    let earned = 0
    let total = 0
    for (const ch of allChapters) {
      const type = ch.chapter_type
      if (type === "quiz" || type === "exam") {
        const qr = chMap.get(ch.id)?.quiz_result
        if (qr) {
          earned += qr.score
          total += qr.max_score
        } else {
          total += 1 // placeholder
        }
      } else if (type === "assignment") {
        const ar = chMap.get(ch.id)?.assignment_result
        const maxPts = ar?.max_score ?? 100
        total += maxPts
        if (ar?.grade !== null && ar?.grade !== undefined) {
          earned += ar.grade
        }
      } else {
        // reading/video/audio etc: 1 point for completion
        total += 1
        if (chMap.get(ch.id)?.completed) earned += 1
      }
    }
    return { earned, total }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Student Grade Table</CardTitle>
          <CardDescription className="text-xs">
            Reading/video chapters = 1 pt for completion · Quiz/exam = scored · Assignment = teacher-graded pts
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs" style={{ minWidth: `${180 + allChapters.length * 64 + 100}px` }}>
              <thead>
                {/* Module header row */}
                <tr>
                  <th className="sticky left-0 z-10 bg-card border-b border-r px-3 py-2 text-left font-semibold text-sm w-44 min-w-[11rem]">
                    Student
                  </th>
                  {orderedModules.map((mod) => {
                    const modChapters = moduleChapterMap.get(mod.id) ?? []
                    if (modChapters.length === 0) return null
                    return (
                      <th
                        key={mod.id}
                        colSpan={modChapters.length}
                        className="border-b border-r px-2 py-2 text-center font-semibold bg-muted/40 truncate max-w-[200px]"
                      >
                        {mod.title}
                      </th>
                    )
                  })}
                  <th className="border-b px-2 py-2 text-center font-semibold bg-muted/40 w-20">
                    Total
                  </th>
                </tr>
                {/* Chapter header row */}
                <tr>
                  <th className="sticky left-0 z-10 bg-card border-b border-r" />
                  {allChapters.map((ch) => (
                    <th
                      key={ch.id}
                      className="border-b border-r px-1 py-1.5 text-center font-normal text-muted-foreground bg-muted/20 w-16"
                      title={ch.title}
                    >
                      <div className="flex flex-col items-center gap-0.5">
                        <span className="text-muted-foreground">{chapterTypeIcon(ch.chapter_type)}</span>
                        <span className="truncate max-w-[52px] text-[10px]">{ch.title}</span>
                      </div>
                    </th>
                  ))}
                  <th className="border-b px-1 py-1.5 bg-muted/20" />
                </tr>
              </thead>

              <tbody>
                {tableStudents.map((student) => {
                  const chMap = studentChapterMap.get(student.id)
                  const { earned, total } = getStudentTotals(student.id)
                  const manualGrade = manualGrades.get(student.id)
                  const isExpanded = expandedId === student.id
                  const form = forms.get(student.id) ?? { grade: "", comment: "" }

                  return (
                    <Fragment key={student.id}>
                      <tr
                        className="hover:bg-muted/20 cursor-pointer transition-colors"
                        onClick={() => toggleExpand(student.id)}
                      >
                        <td className="sticky left-0 z-10 bg-card border-b border-r px-3 py-2 font-medium">
                          <div className="flex items-center gap-1.5 min-w-0">
                            {isExpanded
                              ? <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
                              : <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
                            }
                            <div className="min-w-0">
                              <p className="truncate text-xs font-semibold max-w-[140px]">{student.full_name || student.email}</p>
                              <p className="truncate text-[10px] text-muted-foreground max-w-[140px]">{student.email}</p>
                            </div>
                          </div>
                        </td>
                        {allChapters.map((ch) => (
                          <td key={ch.id} className="border-b border-r px-1 py-1" onClick={(e) => e.stopPropagation()}>
                            <ChapterCell chapter={chMap?.get(ch.id)} />
                          </td>
                        ))}
                        <td className="border-b px-2 py-2 text-center">
                          <div className="flex flex-col items-center">
                            <span className="font-semibold text-sm">{earned}</span>
                            <span className="text-[10px] text-muted-foreground">/{total}</span>
                            {manualGrade?.grade && (
                              <span className={`mt-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${letterColor(manualGrade.grade)}`}>
                                {manualGrade.grade}
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr>
                          <td colSpan={allChapters.length + 2} className="bg-muted/10 border-b px-4 py-3">
                            <div className="flex flex-wrap items-end gap-3">
                              <div className="space-y-1">
                                <label className="text-xs font-medium flex items-center gap-1">
                                  <Award className="h-3 w-3" /> Override Grade
                                </label>
                                <Input
                                  value={form.grade}
                                  onChange={(e) => updateForm(student.id, "grade", e.target.value)}
                                  placeholder="A, B+, 95..."
                                  className="h-8 w-28 text-xs"
                                />
                              </div>
                              <div className="space-y-1 flex-1 min-w-[180px]">
                                <label className="text-xs font-medium flex items-center gap-1">
                                  <MessageSquare className="h-3 w-3" /> Comment
                                </label>
                                <Input
                                  value={form.comment}
                                  onChange={(e) => updateForm(student.id, "comment", e.target.value)}
                                  placeholder="Teacher's note..."
                                  className="h-8 text-xs"
                                />
                              </div>
                              <Button size="sm" className="h-8 text-xs" onClick={() => saveGrade(student.id)} disabled={saving === student.id}>
                                <Save className="h-3 w-3 mr-1" />
                                {saving === student.id ? "Saving..." : "Save Grade"}
                              </Button>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <div className="h-4 w-4 rounded bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 flex items-center justify-center">
                <CheckCircle2 className="h-2.5 w-2.5 text-emerald-600" />
              </div>
              Completed (1 pt)
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-4 w-6 rounded bg-green-50 dark:bg-green-950/20 border border-green-200 text-[9px] flex items-center justify-center text-green-700 font-semibold">85%</div>
              Quiz passed
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-4 w-6 rounded bg-red-50 dark:bg-red-950/20 border border-red-200 text-[9px] flex items-center justify-center text-red-700 font-semibold">40%</div>
              Quiz failed
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-4 w-10 rounded bg-blue-50 dark:bg-blue-950/20 border border-blue-200 text-[9px] flex items-center justify-center text-blue-700 font-semibold">graded</div>
              Assignment graded
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-4 w-14 rounded bg-amber-50 dark:bg-amber-950/20 border border-amber-200 text-[9px] flex items-center justify-center text-amber-700">submitted</div>
              Assignment submitted
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-4 w-4 rounded bg-muted/30 border flex items-center justify-center">
                <Circle className="h-2.5 w-2.5 text-muted-foreground/40" />
              </div>
              Not submitted
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
