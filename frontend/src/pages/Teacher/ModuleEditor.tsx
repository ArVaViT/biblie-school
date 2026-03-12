import { useEffect, useState, useCallback } from "react"
import { useParams, useNavigate, Link } from "react-router-dom"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import RichTextEditor from "@/components/editor/RichTextEditor"
import ChapterBlockEditor from "@/components/editor/ChapterBlockEditor"
import QuizEditor from "@/components/quiz/QuizEditor"
import AssignmentEditor from "@/components/assignment/AssignmentEditor"
import { coursesService } from "@/services/courses"
import type { Module, Chapter } from "@/types"
import { toast } from "@/hooks/use-toast"
import {
  ArrowUp, ArrowDown, Plus, Trash2, Save, FileText, HelpCircle,
  ClipboardList, Puzzle, ChevronDown, ChevronRight,
  Shield, Video, Loader2, Pencil,
} from "lucide-react"

const CHAPTER_TYPES = [
  { value: "content", label: "Content", icon: FileText, desc: "Text and video lessons" },
  { value: "quiz", label: "Quiz", icon: HelpCircle, desc: "Test knowledge" },
  { value: "assignment", label: "Assignment", icon: ClipboardList, desc: "Submit work" },
  { value: "mixed", label: "Mixed", icon: Puzzle, desc: "Combine multiple block types" },
] as const

type ChapterType = (typeof CHAPTER_TYPES)[number]["value"]

function chapterTypeBadge(type: string) {
  const map: Record<string, string> = {
    content: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400",
    quiz: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
    assignment: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-400",
    mixed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400",
  }
  return map[type] ?? map.content
}

export default function ModuleEditor() {
  const { courseId, moduleId } = useParams<{ courseId: string; moduleId: string }>()
  const navigate = useNavigate()

  const [mod, setMod] = useState<Module | null>(null)
  const [loading, setLoading] = useState(true)
  const [savingModule, setSavingModule] = useState(false)

  const [modTitle, setModTitle] = useState("")
  const [modDescription, setModDescription] = useState("")

  const [expandedChapter, setExpandedChapter] = useState<string | null>(null)
  const [chapterContent, setChapterContent] = useState("")
  const [chapterVideoUrl, setChapterVideoUrl] = useState("")
  const [savingChapter, setSavingChapter] = useState(false)

  const load = useCallback(async () => {
    if (!courseId || !moduleId) return
    try {
      const data = await coursesService.getModule(courseId, moduleId)
      setMod(data)
      setModTitle(data.title)
      setModDescription(data.description ?? "")
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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault()
        if (expandedChapter && mod) {
          const ch = mod.chapters?.find((c) => c.id === expandedChapter)
          if (ch && (ch.chapter_type === "content" || !ch.chapter_type)) {
            saveChapterContent(ch)
          }
        }
      }
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [expandedChapter, mod, chapterContent, chapterVideoUrl])

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
      setExpandedChapter(ch.id)
      setChapterContent(ch.content ?? "")
      setChapterVideoUrl(ch.video_url ?? "")
      toast({ title: "Chapter added", variant: "success" })
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

  const changeChapterType = async (ch: Chapter, newType: string) => {
    if (!courseId || !moduleId) return
    updateChapterLocal(ch.id, { chapter_type: newType })
    try {
      await coursesService.updateChapter(courseId, moduleId, ch.id, {
        chapter_type: newType,
      })
    } catch {
      toast({ title: "Failed to update chapter type", variant: "destructive" })
    }
  }

  const toggleRequiresCompletion = async (ch: Chapter) => {
    if (!courseId || !moduleId) return
    const next = !ch.requires_completion
    updateChapterLocal(ch.id, { requires_completion: next })
    try {
      await coursesService.updateChapter(courseId, moduleId, ch.id, {
        requires_completion: next,
      })
    } catch {
      toast({ title: "Failed to update", variant: "destructive" })
    }
  }

  const saveChapterContent = async (ch: Chapter) => {
    if (!courseId || !moduleId) return
    setSavingChapter(true)
    try {
      await coursesService.updateChapter(courseId, moduleId, ch.id, {
        content: chapterContent,
        video_url: chapterVideoUrl.trim() || undefined,
      })
      updateChapterLocal(ch.id, {
        content: chapterContent,
        video_url: chapterVideoUrl.trim() || undefined,
      })
      toast({ title: "Chapter saved", variant: "success" })
    } catch {
      toast({ title: "Failed to save chapter", variant: "destructive" })
    } finally {
      setSavingChapter(false)
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
      if (expandedChapter === chId) setExpandedChapter(null)
      toast({ title: "Chapter deleted", variant: "success" })
    } catch {
      toast({ title: "Failed to delete chapter", variant: "destructive" })
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

    setMod(prev => prev ? { ...prev, chapters: updates } : prev)

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

  const expandChapter = (ch: Chapter) => {
    if (expandedChapter === ch.id) {
      setExpandedChapter(null)
    } else {
      setExpandedChapter(ch.id)
      setChapterContent(ch.content ?? "")
      setChapterVideoUrl(ch.video_url ?? "")
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
          {[1, 2, 3, 4].map(i => (
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
      {/* Module Header */}
      <div className="mb-8">
        <div className="mb-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Link to="/teacher" className="hover:text-foreground transition-colors">My Courses</Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <Link to={`/teacher/courses/${courseId}`} className="hover:text-foreground transition-colors">{mod?.course_id ? "Course" : "Course"}</Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-foreground font-medium truncate max-w-[200px]">{mod?.title || "Module"}</span>
        </div>

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

          <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-primary/10 text-primary">
            {chapters.length} {chapters.length === 1 ? "chapter" : "chapters"}
          </span>
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
        <div className="space-y-4 mb-6">
          {chapters.map((ch, idx) => {
            const isExpanded = expandedChapter === ch.id
            const type = (ch.chapter_type || "content") as ChapterType

            return (
              <Card
                key={ch.id}
                className={
                  isExpanded
                    ? "border-primary/60 shadow-sm"
                    : "border-border/60"
                }
              >
                {/* Collapsed chapter row */}
                <div className="flex items-center gap-3 p-4">
                  <button
                    onClick={() => expandChapter(ch)}
                    className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </button>

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

                  <label className="flex items-center gap-1.5 shrink-0 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={ch.requires_completion ?? false}
                      onChange={() => toggleRequiresCompletion(ch)}
                      className="h-3.5 w-3.5 rounded border-input"
                    />
                    <Shield className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Teacher-marked</span>
                  </label>

                  <div className="flex flex-col shrink-0">
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0" disabled={idx === 0} onClick={(e) => { e.stopPropagation(); moveChapter(ch, idx, -1) }}>
                      <ArrowUp className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0" disabled={idx === chapters.length - 1} onClick={(e) => { e.stopPropagation(); moveChapter(ch, idx, 1) }}>
                      <ArrowDown className="h-3 w-3" />
                    </Button>
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    className="shrink-0 h-8 w-8 p-0"
                    onClick={() => expandChapter(ch)}
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

                {/* Expanded chapter editor */}
                {isExpanded && (
                  <div className="border-t px-6 py-6 space-y-6">
                    {/* Type selector — 2×2 grid */}
                    <div>
                      <Label className="text-sm font-semibold mb-3 block">
                        Chapter Type
                      </Label>
                      <div className="grid grid-cols-2 gap-3">
                        {CHAPTER_TYPES.map((ct) => {
                          const Icon = ct.icon
                          const selected = type === ct.value
                          return (
                            <button
                              key={ct.value}
                              onClick={() => changeChapterType(ch, ct.value)}
                              className={`flex items-start gap-3 rounded-lg border-2 p-4 text-left transition-all ${
                                selected
                                  ? "border-primary bg-primary/5 shadow-sm"
                                  : "border-border hover:border-primary/30 hover:bg-muted/40"
                              }`}
                            >
                              <Icon
                                className={`h-5 w-5 mt-0.5 shrink-0 ${
                                  selected ? "text-primary" : "text-muted-foreground"
                                }`}
                              />
                              <div>
                                <div
                                  className={`text-sm font-medium ${
                                    selected ? "text-primary" : ""
                                  }`}
                                >
                                  {ct.label}
                                </div>
                                <div className="text-xs text-muted-foreground mt-0.5">
                                  {ct.desc}
                                </div>
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    {/* Conditional editor based on chapter type */}
                    {type === "content" && (
                      <div className="space-y-4">
                        <div className="space-y-1.5">
                          <Label className="text-xs flex items-center gap-1.5">
                            <Video className="h-3.5 w-3.5" />
                            YouTube Video URL (optional)
                          </Label>
                          <Input
                            value={chapterVideoUrl}
                            onChange={(e) => setChapterVideoUrl(e.target.value)}
                            placeholder="https://www.youtube.com/watch?v=..."
                            className="h-9 text-sm"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Content</Label>
                          <RichTextEditor
                            content={chapterContent}
                            onChange={setChapterContent}
                            placeholder="Write chapter content here..."
                          />
                        </div>
                        <Button
                          size="sm"
                          onClick={() => saveChapterContent(ch)}
                          disabled={savingChapter}
                        >
                          {savingChapter ? (
                            <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                          ) : (
                            <Save className="h-3.5 w-3.5 mr-1.5" />
                          )}
                          {savingChapter ? "Saving..." : "Save Content"}
                        </Button>
                      </div>
                    )}

                    {type === "quiz" && (
                      <QuizEditor chapterId={ch.id} />
                    )}

                    {type === "assignment" && (
                      <AssignmentEditor chapterId={ch.id} />
                    )}

                    {type === "mixed" && (
                      <ChapterBlockEditor chapterId={ch.id} />
                    )}
                  </div>
                )}
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
