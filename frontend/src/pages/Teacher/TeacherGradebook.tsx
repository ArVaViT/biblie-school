import { useEffect, useState, useCallback, useMemo } from "react"
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
} from "lucide-react"

type SortField = "name" | "quiz" | "assignment" | "participation" | "final" | "letter"
type SortDir = "asc" | "desc"

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

interface GradeForm {
  grade: string
  comment: string
}

export default function TeacherGradebook() {
  const { courseId } = useParams<{ courseId: string }>()
  const [courseTitle, setCourseTitle] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Grading config
  const [config, setConfig] = useState<GradingConfig>({ quiz_weight: 30, assignment_weight: 50, participation_weight: 20 })
  const [configDraft, setConfigDraft] = useState<GradingConfig>(config)
  const [configOpen, setConfigOpen] = useState(false)
  const [savingConfig, setSavingConfig] = useState(false)

  // Grade summary
  const [summary, setSummary] = useState<GradeSummaryResponse | null>(null)
  const [manualGrades, setManualGrades] = useState<Map<string, StudentGrade>>(new Map())

  // Manual grade forms
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [forms, setForms] = useState<Map<string, GradeForm>>(new Map())
  const [saving, setSaving] = useState<string | null>(null)

  // Sort state
  const [sortField, setSortField] = useState<SortField>("name")
  const [sortDir, setSortDir] = useState<SortDir>("asc")

  const load = useCallback(async () => {
    if (!courseId) return
    setLoading(true)
    setError(null)
    try {
      const [course, rawGrades] = await Promise.all([
        coursesService.getCourse(courseId),
        coursesService.getCourseGrades(courseId).catch(() => []),
      ])
      setCourseTitle(course.title)

      const gradeMap = new Map<string, StudentGrade>()
      const formMap = new Map<string, GradeForm>()
      for (const g of rawGrades ?? []) {
        gradeMap.set(g.student_id, g)
        formMap.set(g.student_id, { grade: g.grade ?? "", comment: g.comment ?? "" })
      }
      setManualGrades(gradeMap)
      setForms(formMap)

      try {
        const gradeSummary = await coursesService.getGradeSummary(courseId)
        setSummary(gradeSummary)
        setConfig(gradeSummary.config)
        setConfigDraft(gradeSummary.config)
      } catch {
        // Grade summary may fail on cold start; page still works with manual grades
      }
    } catch {
      setError("Failed to load gradebook. Please try again.")
    } finally {
      setLoading(false)
    }
  }, [courseId])

  useEffect(() => { load() }, [load])

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
      // Reload summary with new weights
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
        case "name":
          cmp = (a.student_name ?? "").localeCompare(b.student_name ?? "")
          break
        case "quiz":
          cmp = a.breakdown.quiz_avg - b.breakdown.quiz_avg
          break
        case "assignment":
          cmp = a.breakdown.assignment_avg - b.breakdown.assignment_avg
          break
        case "participation":
          cmp = a.breakdown.participation_pct - b.breakdown.participation_pct
          break
        case "final":
          cmp = a.breakdown.final_score - b.breakdown.final_score
          break
        case "letter":
          cmp = (LETTER_ORDER[a.breakdown.letter_grade] ?? 0) - (LETTER_ORDER[b.breakdown.letter_grade] ?? 0)
          break
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
            <Button onClick={load} size="sm" variant="outline">Try again</Button>
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
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
        <Link to="/teacher" className="hover:text-foreground transition-colors">My Courses</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-foreground font-medium">Gradebook</span>
      </div>

      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Award className="h-7 w-7 text-primary" />
          Gradebook
        </h1>
        {courseTitle && <p className="text-muted-foreground mt-1">{courseTitle}</p>}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Students</p>
                <p className="text-2xl font-bold mt-1">{studentCount}</p>
              </div>
              <Users className="h-8 w-8 text-blue-600 opacity-80" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Class Average</p>
                <p className="text-2xl font-bold mt-1">{classAvg.toFixed(1)}%</p>
              </div>
              <TrendingUp className="h-8 w-8 text-emerald-600 opacity-80" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Manually Graded</p>
                <p className="text-2xl font-bold mt-1">{gradedCount} / {studentCount}</p>
              </div>
              <Award className="h-8 w-8 text-amber-600 opacity-80" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Weights</p>
                <p className="text-sm font-medium mt-1">
                  Q:{config.quiz_weight} A:{config.assignment_weight} P:{config.participation_weight}
                </p>
              </div>
              <Calculator className="h-8 w-8 text-purple-600 opacity-80" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Grading Configuration */}
      <Card className="mb-8">
        <CardHeader
          className="cursor-pointer select-none"
          onClick={() => setConfigOpen(!configOpen)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Settings2 className="h-5 w-5 text-muted-foreground" />
              <div>
                <CardTitle className="text-base">Grading Configuration</CardTitle>
                <CardDescription>Set how quizzes, assignments, and participation contribute to final grades</CardDescription>
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
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={configDraft.quiz_weight}
                  onChange={(e) => setConfigDraft({ ...configDraft, quiz_weight: Number(e.target.value) || 0 })}
                  className="h-9"
                />
              </div>
              <div className="space-y-2">
                <Label>Assignment Weight (%)</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={configDraft.assignment_weight}
                  onChange={(e) => setConfigDraft({ ...configDraft, assignment_weight: Number(e.target.value) || 0 })}
                  className="h-9"
                />
              </div>
              <div className="space-y-2">
                <Label>Participation Weight (%)</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={configDraft.participation_weight}
                  onChange={(e) => setConfigDraft({ ...configDraft, participation_weight: Number(e.target.value) || 0 })}
                  className="h-9"
                />
              </div>
            </div>
            <div className="flex items-center justify-between mt-4">
              <p className={`text-sm font-medium ${configValid ? "text-emerald-600" : "text-destructive"}`}>
                Total: {configTotal}% {configValid ? "✓" : `(must equal 100%)`}
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
            Auto-calculated grades based on quiz scores, assignment grades, and chapter completion. Click a student to override manually.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {studentCount === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No students enrolled yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              {/* Table header */}
              <div className="grid grid-cols-[1fr_80px_80px_90px_80px_70px_70px] gap-3 px-4 py-3 border-b bg-muted/30 rounded-t-lg min-w-[700px]">
                <SortHeader field="name" label="Student" />
                <SortHeader field="quiz" label="Quiz" className="justify-end" />
                <SortHeader field="assignment" label="Assign." className="justify-end" />
                <SortHeader field="participation" label="Particip." className="justify-end" />
                <SortHeader field="final" label="Final" className="justify-end" />
                <SortHeader field="letter" label="Grade" className="justify-center" />
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-center">Manual</span>
              </div>

              {/* Student rows */}
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
                          {isExpanded ? (
                            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          ) : (
                            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          )}
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

                      {/* Expanded: grade breakdown + manual grade form */}
                      {isExpanded && (
                        <div className="border-t px-4 py-4 bg-muted/10 space-y-4">
                          {/* Breakdown detail */}
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

                          {/* Manual override form */}
                          <div className="grid grid-cols-1 sm:grid-cols-[120px_1fr] gap-3">
                            <div className="space-y-1.5">
                              <label className="text-xs font-medium flex items-center gap-1">
                                <Award className="h-3 w-3" /> Override Grade
                              </label>
                              <Input
                                value={form.grade}
                                onChange={(e) => updateForm(student.student_id, "grade", e.target.value)}
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
                                onChange={(e) => updateForm(student.student_id, "comment", e.target.value)}
                                placeholder="Teacher's note about this student..."
                                className="h-9"
                              />
                            </div>
                          </div>

                          <Button
                            size="sm"
                            onClick={() => saveGrade(student.student_id)}
                            disabled={saving === student.student_id}
                          >
                            <Save className="h-3.5 w-3.5 mr-1.5" />
                            {saving === student.student_id ? "Saving..." : "Save Manual Grade"}
                          </Button>
                        </div>
                      )}
                    </div>
                  )
                })}

                {/* Summary row */}
                {studentCount > 0 && (
                  <div className="grid grid-cols-[1fr_80px_80px_90px_80px_70px_70px] gap-3 px-4 py-3 bg-muted/40 font-semibold text-sm items-center border-t-2">
                    <span className="pl-6">Class Average ({studentCount} students)</span>
                    <p className="tabular-nums text-right">
                      {(summary!.students.reduce((s, st) => s + st.breakdown.quiz_avg, 0) / studentCount).toFixed(1)}%
                    </p>
                    <p className="tabular-nums text-right">
                      {(summary!.students.reduce((s, st) => s + st.breakdown.assignment_avg, 0) / studentCount).toFixed(1)}%
                    </p>
                    <p className="tabular-nums text-right">
                      {(summary!.students.reduce((s, st) => s + st.breakdown.participation_pct, 0) / studentCount).toFixed(1)}%
                    </p>
                    <p className="tabular-nums text-right">{classAvg.toFixed(1)}%</p>
                    <span />
                    <span />
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
