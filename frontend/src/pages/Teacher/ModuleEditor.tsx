import { useEffect, useState, useCallback } from "react"
import { useParams, useNavigate, Link } from "react-router-dom"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { coursesService } from "@/services/courses"
import type { Module, Chapter } from "@/types"
import { toast } from "@/hooks/use-toast"
import { Label } from "@/components/ui/label"
import {
  ArrowUp, ArrowDown, Plus, Trash2, ChevronRight,
  Loader2, Pencil, CalendarDays, Lock, Unlock,
} from "lucide-react"

const CHAPTER_TYPE_BADGES: Record<string, string> = {
  reading: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400",
  content: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400",
  video: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-400",
  audio: "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-400",
  quiz: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
  exam: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400",
  assignment: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-400",
  discussion: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400",
  mixed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400",
}

function chapterTypeBadge(type: string) {
  return CHAPTER_TYPE_BADGES[type] ?? CHAPTER_TYPE_BADGES.reading
}

export default function ModuleEditor() {
  const { courseId, moduleId } = useParams<{ courseId: string; moduleId: string }>()
  const navigate = useNavigate()

  const [mod, setMod] = useState<Module | null>(null)
  const [loading, setLoading] = useState(true)
  const [savingModule, setSavingModule] = useState(false)

  const [modTitle, setModTitle] = useState("")
  const [modDescription, setModDescription] = useState("")
  const [modDueDate, setModDueDate] = useState("")

  const load = useCallback(async () => {
    if (!courseId || !moduleId) return
    try {
      const data = await coursesService.getModule(courseId, moduleId)
      setMod(data)
      setModTitle(data.title)
      setModDescription(data.description ?? "")
      setModDueDate(data.due_date ? data.due_date.slice(0, 16) : "")
    } catch {
      toast({ title: "Module not found", variant: "destructive" })
      navigate(`/teacher/courses/${courseId}`)
    } finally {
      setLoading(false)
    }
  }, [courseId, moduleId, navigate])

  useEffect(() => {
    load()
  }, [load])

  const saveModuleDetails = async (field: "title" | "description", value: string) => {
    if (!courseId || !moduleId) return
    const trimmed = value.trim()
    if (field === "title" && !trimmed) return
    setSavingModule(true)
    try {
      await coursesService.updateModule(courseId, moduleId, { [field]: trimmed })
      setMod((prev) => (prev ? { ...prev, [field]: trimmed } : prev))
    } catch {
      toast({ title: "Failed to save module", variant: "destructive" })
    } finally {
      setSavingModule(false)
    }
  }

  const saveDueDate = async (value: string) => {
    if (!courseId || !moduleId) return
    setSavingModule(true)
    try {
      const due = value ? new Date(value).toISOString() : null
      await coursesService.updateModule(courseId, moduleId, { due_date: due } as any)
      setMod((prev) => (prev ? { ...prev, due_date: due } : prev))
    } catch {
      toast({ title: "Failed to save due date", variant: "destructive" })
    } finally {
      setSavingModule(false)
    }
  }

  const addChapter = async () => {
    if (!courseId || !moduleId || !mod) return
    const order = mod.chapters?.length ?? 0
    try {
      const ch = await coursesService.createChapter(courseId, moduleId, {
        title: `Chapter ${order + 1}`,
        order_index: order,
      })
      setMod((prev) =>
        prev ? { ...prev, chapters: [...(prev.chapters ?? []), ch] } : prev,
      )
      toast({ title: "Chapter added", variant: "success" })
      navigate(`/teacher/courses/${courseId}/modules/${moduleId}/chapters/${ch.id}/edit`)
    } catch {
      toast({ title: "Failed to add chapter", variant: "destructive" })
    }
  }

  const updateChapterLocal = (chapterId: string, patch: Partial<Chapter>) => {
    setMod((prev) =>
      prev
        ? {
            ...prev,
            chapters: prev.chapters?.map((c) =>
              c.id === chapterId ? { ...c, ...patch } : c,
            ),
          }
        : prev,
    )
  }

  const renameChapter = async (ch: Chapter, newTitle: string) => {
    if (!courseId || !moduleId || !newTitle.trim()) return
    updateChapterLocal(ch.id, { title: newTitle.trim() })
    try {
      await coursesService.updateChapter(courseId, moduleId, ch.id, {
        title: newTitle.trim(),
      })
    } catch {
      toast({ title: "Failed to rename chapter", variant: "destructive" })
    }
  }

  const deleteChapter = async (chId: string) => {
    if (!courseId || !moduleId || !confirm("Delete this chapter?")) return
    try {
      await coursesService.deleteChapter(courseId, moduleId, chId)
      setMod((prev) =>
        prev
          ? { ...prev, chapters: prev.chapters?.filter((c) => c.id !== chId) }
          : prev,
      )
      toast({ title: "Chapter deleted", variant: "success" })
    } catch {
      toast({ title: "Failed to delete chapter", variant: "destructive" })
    }
  }

  const toggleLock = async (ch: Chapter) => {
    if (!courseId || !moduleId) return
    const newLocked = !ch.is_locked
    updateChapterLocal(ch.id, { is_locked: newLocked })
    try {
      await coursesService.updateChapter(courseId, moduleId, ch.id, { is_locked: newLocked })
      toast({ title: newLocked ? "Chapter locked" : "Chapter unlocked", variant: "success" })
    } catch (err: any) {
      updateChapterLocal(ch.id, { is_locked: ch.is_locked })
      const detail = err?.response?.data?.detail || "Unknown error"
      toast({ title: `Failed to toggle lock: ${detail}`, variant: "destructive" })
    }
  }

  const moveChapter = async (ch: Chapter, currentIdx: number, direction: number) => {
    const newIdx = currentIdx + direction
    if (newIdx < 0 || newIdx >= chapters.length) return
    const other = chapters[newIdx]

    const updates = chapters.map((c) => {
      if (c.id === ch.id) return { ...c, order_index: other.order_index }
      if (c.id === other.id) return { ...c, order_index: ch.order_index }
      return c
    })

    setMod((prev) => (prev ? { ...prev, chapters: updates } : prev))

    try {
      await Promise.all([
        coursesService.updateChapter(courseId!, moduleId!, ch.id, { order_index: other.order_index }),
        coursesService.updateChapter(courseId!, moduleId!, other.id, { order_index: ch.order_index }),
      ])
    } catch {
      toast({ title: "Failed to reorder", variant: "destructive" })
      load()
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <div className="h-8 w-32 bg-muted rounded animate-pulse mb-6" />
        <div className="space-y-3 mb-6">
          <div className="h-8 w-3/4 bg-muted rounded animate-pulse" />
          <div className="h-4 w-1/2 bg-muted rounded animate-pulse" />
        </div>
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-lg border p-4 space-y-2">
              <div className="flex items-center gap-3">
                <div className="h-5 w-5 bg-muted rounded animate-pulse" />
                <div className="h-5 flex-1 bg-muted rounded animate-pulse" />
                <div className="h-5 w-16 bg-muted rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (!mod) return null

  const chapters = [...(mod.chapters ?? [])].sort(
    (a, b) => a.order_index - b.order_index,
  )

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Breadcrumb */}
      <div className="mb-8">
        <div className="mb-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Link to="/teacher" className="hover:text-foreground transition-colors">My Courses</Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <Link to={`/teacher/courses/${courseId}`} className="hover:text-foreground transition-colors">Course</Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-foreground font-medium truncate max-w-[200px]">{mod?.title || "Module"}</span>
        </div>

        {/* Module title / description */}
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Input
              value={modTitle}
              onChange={(e) => setModTitle(e.target.value)}
              onBlur={() => saveModuleDetails("title", modTitle)}
              className="font-serif text-2xl font-bold border-none shadow-none hover:border-border/50 hover:shadow-sm focus-visible:ring-1 h-auto py-1 px-2"
              placeholder="Module title"
            />
            {savingModule && (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />
            )}
          </div>

          <Input
            value={modDescription}
            onChange={(e) => setModDescription(e.target.value)}
            onBlur={() => saveModuleDetails("description", modDescription)}
            className="text-sm text-muted-foreground border-none shadow-none hover:border-border/50 hover:shadow-sm focus-visible:ring-1 h-auto py-1 px-2"
            placeholder="Module description (optional)"
          />

          <div className="flex items-center gap-4 flex-wrap">
            <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-primary/10 text-primary">
              {chapters.length} {chapters.length === 1 ? "chapter" : "chapters"}
            </span>

            <div className="flex items-center gap-2">
              <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
              <Label className="text-xs text-muted-foreground">Due date:</Label>
              <Input
                type="datetime-local"
                value={modDueDate}
                onChange={(e) => setModDueDate(e.target.value)}
                onBlur={(e) => saveDueDate(e.target.value)}
                className="text-xs h-7 w-auto border-border/50"
              />
              {modDueDate && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[10px] text-muted-foreground"
                  onClick={() => { setModDueDate(""); saveDueDate("") }}
                >
                  Clear
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Chapter List */}
      {chapters.length === 0 ? (
        <Card className="border-dashed mb-6">
          <CardContent className="py-12 text-center text-muted-foreground">
            <p>No chapters yet. Add your first chapter to start building this module.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3 mb-6">
          {chapters.map((ch, idx) => {
            const type = ch.chapter_type || "reading"

            return (
              <Card key={ch.id} className="border-border/60">
                <div className="flex items-center gap-3 p-4">
                  <Input
                    value={ch.title}
                    onChange={(e) => updateChapterLocal(ch.id, { title: e.target.value })}
                    onBlur={(e) => renameChapter(ch, e.target.value)}
                    className="font-medium border-none shadow-none focus-visible:ring-1 h-8 text-sm flex-1"
                  />

                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium shrink-0 capitalize ${chapterTypeBadge(type)}`}
                  >
                    {type}
                  </span>

                  <Button
                    variant="ghost"
                    size="sm"
                    className={`shrink-0 h-8 w-8 p-0 ${ch.is_locked ? "text-amber-600 hover:text-amber-700" : "text-muted-foreground"}`}
                    onClick={() => toggleLock(ch)}
                    title={ch.is_locked ? "Unlock chapter" : "Lock chapter"}
                  >
                    {ch.is_locked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
                  </Button>

                  <div className="flex flex-col shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      disabled={idx === 0}
                      onClick={() => moveChapter(ch, idx, -1)}
                    >
                      <ArrowUp className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      disabled={idx === chapters.length - 1}
                      onClick={() => moveChapter(ch, idx, 1)}
                    >
                      <ArrowDown className="h-3 w-3" />
                    </Button>
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    className="shrink-0 h-8 w-8 p-0"
                    onClick={() =>
                      navigate(
                        `/teacher/courses/${courseId}/modules/${moduleId}/chapters/${ch.id}/edit`,
                      )
                    }
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    className="shrink-0 h-8 w-8 p-0 text-destructive hover:text-destructive"
                    onClick={() => deleteChapter(ch.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* Add Chapter */}
      <Button
        variant="outline"
        className="w-full border-dashed h-12"
        onClick={addChapter}
      >
        <Plus className="h-4 w-4 mr-2" />
        Add Chapter
      </Button>
    </div>
  )
}
