import { useEffect, useState, useCallback, useMemo } from "react"
import { useParams, useSearchParams, Link } from "react-router-dom"
import PageSpinner from "@/components/ui/PageSpinner"
import { Button } from "@/components/ui/button"
import { coursesService } from "@/services/courses"
import type { GradingConfig, GradeSummaryResponse, StudentGrade } from "@/types"
import { toast } from "@/lib/toast"
import { ArrowLeft, Award, ChevronRight, Download } from "lucide-react"
import { ErrorState } from "@/components/patterns"
import {
  SORT_FIELDS,
  TABS,
  type ActiveTab,
  type SortField,
  type SortDir,
  type ChapterInfo,
  type GradeForm,
  type ProgressResponse,
} from "./gradebook/types"
import { GradebookStats } from "./gradebook/GradebookStats"
import { GradebookTabs } from "./gradebook/GradebookTabs"
import { GradingConfigCard } from "./gradebook/GradingConfigCard"
import { SummaryTab } from "./gradebook/SummaryTab"
import { GradeTableTab } from "./gradebook/GradeTableTab"

/**
 * Gradebook page: top-level composition of the summary view, the grade
 * table view, stats, and grading-config card. This component owns all
 * state (config drafts, manual grade forms, expanded row, loaders); the
 * per-tab components are pure, prop-driven render layers.
 */
export default function TeacherGradebook() {
  const { courseId } = useParams<{ courseId: string }>()
  const [params, setParams] = useSearchParams()

  const activeTab: ActiveTab = (TABS as readonly string[]).includes(params.get("tab") ?? "")
    ? (params.get("tab") as ActiveTab)
    : "summary"
  const sortField: SortField = (SORT_FIELDS as readonly string[]).includes(params.get("sort") ?? "")
    ? (params.get("sort") as SortField)
    : "name"
  const sortDir: SortDir = params.get("dir") === "desc" ? "desc" : "asc"

  const setActiveTab = (next: ActiveTab) =>
    setParams(
      (p) => {
        const n = new URLSearchParams(p)
        if (next === "summary") n.delete("tab")
        else n.set("tab", next)
        return n
      },
      { replace: true },
    )

  const applySort = (field: SortField, dir: SortDir) =>
    setParams(
      (p) => {
        const n = new URLSearchParams(p)
        if (field === "name") n.delete("sort")
        else n.set("sort", field)
        if (dir === "asc") n.delete("dir")
        else n.set("dir", dir)
        return n
      },
      { replace: true },
    )

  const [courseTitle, setCourseTitle] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [config, setConfig] = useState<GradingConfig>({
    quiz_weight: 30,
    assignment_weight: 50,
    participation_weight: 20,
  })
  const [configDraft, setConfigDraft] = useState<GradingConfig>(config)
  const [configOpen, setConfigOpen] = useState(false)
  const [savingConfig, setSavingConfig] = useState(false)

  const [summary, setSummary] = useState<GradeSummaryResponse | null>(null)
  const [manualGrades, setManualGrades] = useState<Map<string, StudentGrade>>(new Map())
  const [progressData, setProgressData] = useState<ProgressResponse | null>(null)

  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [forms, setForms] = useState<Map<string, GradeForm>>(new Map())
  const [saving, setSaving] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)

  const [reloadKey, setReloadKey] = useState(0)
  const reload = useCallback(() => setReloadKey((k) => k + 1), [])

  useEffect(() => {
    if (!courseId) return
    let cancelled = false
    setLoading(true)
    setError(null)
    setExpandedId(null)
    ;(async () => {
      try {
        const [course, rawGrades, gradeSummary, progress] = await Promise.all([
          coursesService.getCourse(courseId),
          coursesService.getCourseGrades(courseId).catch(() => []),
          coursesService.getGradeSummary(courseId).catch(() => null),
          coursesService.getStudentProgress(courseId).catch(() => null),
        ])
        if (cancelled) return
        setCourseTitle(course.title)

        const gradeMap = new Map<string, StudentGrade>()
        const formMap = new Map<string, GradeForm>()
        for (const g of rawGrades ?? []) {
          gradeMap.set(g.student_id, g)
          formMap.set(g.student_id, {
            grade: g.grade ?? "",
            comment: g.comment ?? "",
          })
        }
        setManualGrades(gradeMap)
        setForms(formMap)

        if (gradeSummary) {
          setSummary(gradeSummary)
          setConfig(gradeSummary.config)
          setConfigDraft(gradeSummary.config)
        }
        if (progress) {
          setProgressData(progress as ProgressResponse)
        }
      } catch {
        if (!cancelled) setError("Failed to load gradebook. Please try again.")
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [courseId, reloadKey])

  const saveConfig = async () => {
    if (!courseId) return
    const total =
      configDraft.quiz_weight + configDraft.assignment_weight + configDraft.participation_weight
    if (total !== 100) return
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

  const handleExportCSV = async () => {
    if (!courseId) return
    setExporting(true)
    try {
      const blob = await coursesService.exportGradesCSV(courseId)
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      const safeTitle = (courseTitle || courseId || "export")
        .replace(/[\\/:*?"<>|]/g, "_")
        .slice(0, 50)
        .trim()
      a.download = `grades_${safeTitle}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast({ title: "Failed to export grades", variant: "destructive" })
    } finally {
      setExporting(false)
    }
  }

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

  const tableStudents = useMemo(() => {
    if (!progressData) return []
    return [...progressData.students].sort((a, b) =>
      (a.full_name ?? "").localeCompare(b.full_name ?? ""),
    )
  }, [progressData])

  if (loading) return <PageSpinner />

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <ErrorState
          icon={<Award />}
          description={error}
          action={
            <Button onClick={reload} size="sm" variant="outline">
              Try again
            </Button>
          }
          secondaryAction={
            <Link to="/teacher">
              <Button size="sm" variant="ghost">
                <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
                Back to courses
              </Button>
            </Link>
          }
        />
      </div>
    )
  }

  const studentCount = summary?.students.length ?? 0
  const classAvg = summary?.class_average ?? 0

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
        <Link to="/teacher" className="hover:text-foreground transition-colors">
          My Courses
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-foreground font-medium">Gradebook</span>
      </div>

      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Award className="h-7 w-7 text-primary" />
            Gradebook
          </h1>
          {courseTitle && <p className="text-muted-foreground mt-1">{courseTitle}</p>}
        </div>
        {studentCount > 0 && (
          <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={exporting}>
            <Download className="h-4 w-4 mr-1.5" />
            {exporting ? "Exporting..." : "Export CSV"}
          </Button>
        )}
      </div>

      <GradebookStats
        studentCount={studentCount}
        classAverage={classAvg}
        gradedCount={manualGrades.size}
        config={config}
      />

      <GradebookTabs active={activeTab} onChange={setActiveTab} />

      {activeTab === "summary" && (
        <>
          <GradingConfigCard
            open={configOpen}
            onToggle={() => setConfigOpen(!configOpen)}
            draft={configDraft}
            onDraftChange={setConfigDraft}
            onSave={saveConfig}
            saving={savingConfig}
          />
          <SummaryTab
            summary={summary}
            config={config}
            manualGrades={manualGrades}
            forms={forms}
            saving={saving}
            expandedId={expandedId}
            sortField={sortField}
            sortDir={sortDir}
            onSortChange={applySort}
            onToggleExpand={toggleExpand}
            onUpdateForm={updateForm}
            onSaveGrade={saveGrade}
          />
        </>
      )}

      {activeTab === "table" && (
        <GradeTableTab
          progressData={progressData}
          orderedModules={orderedModules}
          moduleChapterMap={moduleChapterMap}
          studentChapterMap={studentChapterMap}
          tableStudents={tableStudents}
          manualGrades={manualGrades}
          forms={forms}
          saving={saving}
          expandedId={expandedId}
          onUpdateForm={updateForm}
          onSaveGrade={saveGrade}
          onToggleExpand={toggleExpand}
        />
      )}
    </div>
  )
}
