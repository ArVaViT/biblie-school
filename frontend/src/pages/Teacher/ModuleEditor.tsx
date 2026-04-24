import { useEffect, useState, useCallback } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { coursesService } from "@/services/courses"
import { getErrorDetail } from "@/lib/errorDetail"
import type { Module, Chapter } from "@/types"
import { toast } from "@/lib/toast"
import { moduleSchema, chapterSchema } from "@/lib/validations/course"
import { useConfirm } from "@/components/ui/alert-dialog"
import { Label } from "@/components/ui/label"
import {
  Plus, Trash2, Pencil, CalendarDays, Lock, Unlock, GripVertical,
} from "lucide-react"

import { getChapterTypeMeta } from "@/lib/chapterTypes"
import { InlineEdit } from "@/components/patterns/InlineEdit"
import { PageHeader } from "@/components/patterns/PageHeader"
import { EmptyState } from "@/components/patterns/EmptyState"

function chapterTypeBadge(type: string) {
  return getChapterTypeMeta(type).badgeColor
}

export default function ModuleEditor() {
  const { courseId, moduleId } = useParams<{ courseId: string; moduleId: string }>()
  const navigate = useNavigate()
  const confirm = useConfirm()

  const [mod, setMod] = useState<Module | null>(null)
  const [loading, setLoading] = useState(true)

  const [modDueDate, setModDueDate] = useState("")

  const load = useCallback(async (signal?: { cancelled: boolean }) => {
    if (!courseId || !moduleId) return
    setLoading(true)
    try {
      const data = await coursesService.getModule(courseId, moduleId)
      if (signal?.cancelled) return
      setMod(data)
      setModDueDate(data.due_date ? data.due_date.slice(0, 16) : "")
    } catch {
      if (signal?.cancelled) return
      toast({ title: "Module not found", variant: "destructive" })
      navigate(`/teacher/courses/${courseId}`)
    } finally {
      if (!signal?.cancelled) setLoading(false)
    }
  }, [courseId, moduleId, navigate])

  useEffect(() => {
    const signal = { cancelled: false }
    load(signal)
    return () => { signal.cancelled = true }
  }, [load])

  const saveModuleField = async (field: "title" | "description", value: string) => {
    if (!courseId || !moduleId) return
    const check = moduleSchema
      .pick({ title: true, description: true })
      .partial()
      .safeParse({ [field]: value })
    if (!check.success) {
      toast({
        title: check.error.issues[0]?.message ?? `Invalid ${field}`,
        variant: "destructive",
      })
      throw new Error("validation")
    }
    try {
      await coursesService.updateModule(courseId, moduleId, { [field]: value })
      setMod((prev) => (prev ? { ...prev, [field]: value } : prev))
    } catch {
      toast({ title: "Failed to save module", variant: "destructive" })
      throw new Error("save failed")
    }
  }

  const saveDueDate = async (value: string) => {
    if (!courseId || !moduleId) return
    try {
      const due = value ? new Date(value).toISOString() : null
      await coursesService.updateModule(courseId, moduleId, { due_date: due })
      setMod((prev) => (prev ? { ...prev, due_date: due } : prev))
    } catch {
      toast({ title: "Failed to save due date", variant: "destructive" })
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
    const trimmed = newTitle.trim()
    const check = chapterSchema.pick({ title: true }).safeParse({ title: trimmed })
    if (!check.success) {
      toast({
        title: check.error.issues[0]?.message ?? "Invalid chapter title",
        variant: "destructive",
      })
      return
    }
    const previousTitle = ch.title
    updateChapterLocal(ch.id, { title: trimmed })
    try {
      await coursesService.updateChapter(courseId, moduleId, ch.id, {
        title: trimmed,
      })
    } catch {
      updateChapterLocal(ch.id, { title: previousTitle })
      toast({ title: "Failed to rename chapter", variant: "destructive" })
    }
  }

  const deleteChapter = async (chId: string) => {
    if (!courseId || !moduleId) return
    const ok = await confirm({
      title: "Delete this chapter?",
      description: "The chapter and its content will be removed.",
      confirmLabel: "Delete",
      tone: "destructive",
    })
    if (!ok) return
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
    } catch (error: unknown) {
      updateChapterLocal(ch.id, { is_locked: ch.is_locked })
      const detail = getErrorDetail(error) || "Unknown error"
      toast({ title: `Failed to toggle lock: ${detail}`, variant: "destructive" })
    }
  }

  const [reorderingChapters, setReorderingChapters] = useState(false)

  const handleChapterDragEnd = useCallback(async (result: DropResult) => {
    if (!result.destination || !courseId || !moduleId || reorderingChapters) return
    const from = result.source.index
    const to = result.destination.index
    if (from === to) return

    const sorted = [...(mod?.chapters ?? [])].sort((a, b) => a.order_index - b.order_index)
    const reordered = Array.from(sorted)
    const [moved] = reordered.splice(from, 1)
    if (!moved) return
    reordered.splice(to, 0, moved)

    setMod(prev => {
      if (!prev) return prev
      return { ...prev, chapters: reordered.map((c, i) => ({ ...c, order_index: i })) }
    })

    setReorderingChapters(true)
    try {
      await Promise.all(
        reordered.map((c, i) =>
          c.order_index !== i
            ? coursesService.updateChapter(courseId, moduleId, c.id, { order_index: i })
            : null
        ).filter(Boolean)
      )
    } catch {
      toast({ title: "Failed to save chapter order", variant: "destructive" })
      load()
    } finally {
      setReorderingChapters(false)
    }
  }, [mod, courseId, moduleId, load, reorderingChapters])

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

  if (!mod) return (
    <div className="container mx-auto px-4 py-16 text-center">
      <p className="text-muted-foreground">Module not found or failed to load.</p>
      <Button variant="outline" size="sm" className="mt-4" onClick={() => navigate(`/teacher/courses/${courseId}`)}>Back to course</Button>
    </div>
  )

  const chapters = [...(mod.chapters ?? [])].sort(
    (a, b) => a.order_index - b.order_index,
  )

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <PageHeader
        backTo={`/teacher/courses/${courseId}`}
        backLabel="Back to course"
        title={
          <InlineEdit
            size="h1"
            value={mod.title}
            onSave={(v) => saveModuleField("title", v)}
            required
            placeholder="Untitled module"
            ariaLabel="Edit module title"
            maxLength={200}
          />
        }
        description={
          <InlineEdit
            size="body"
            multiline
            value={mod.description ?? ""}
            onSave={(v) => saveModuleField("description", v)}
            placeholder="Add a module description"
            ariaLabel="Edit module description"
            maxLength={2000}
          />
        }
        meta={
          <>
            <Badge variant="muted">
              {chapters.length} {chapters.length === 1 ? "chapter" : "chapters"}
            </Badge>
            <div className="flex items-center gap-2">
              <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
              <Label className="text-xs text-muted-foreground">Due date</Label>
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
                  className="h-6 text-xs text-muted-foreground"
                  onClick={() => { setModDueDate(""); void saveDueDate("") }}
                >
                  Clear
                </Button>
              )}
            </div>
          </>
        }
      />

      {chapters.length === 0 ? (
        <EmptyState
          icon={<Pencil />}
          title="No chapters yet"
          description="Add your first chapter to start building this module."
          action={
            <Button onClick={addChapter} size="sm">
              <Plus className="h-4 w-4 mr-1.5" />
              Add chapter
            </Button>
          }
          className="mb-6"
        />
      ) : (
        <DragDropContext onDragEnd={handleChapterDragEnd}>
          <Droppable droppableId="chapters">
            {(provided) => (
              <div className="space-y-3 mb-6" ref={provided.innerRef} {...provided.droppableProps}>
                {chapters.map((ch, idx) => {
                  const type = ch.chapter_type || "reading"

                  return (
                    <Draggable key={ch.id} draggableId={ch.id} index={idx}>
                      {(dragProvided, snapshot) => (
                        <Card
                          ref={dragProvided.innerRef}
                          {...dragProvided.draggableProps}
                          className={`border-border/60 ${snapshot.isDragging ? "shadow-lg ring-2 ring-primary/20" : ""}`}
                        >
                          <div className="flex items-center gap-3 p-4">
                            <div
                              {...dragProvided.dragHandleProps}
                              className="cursor-grab active:cursor-grabbing text-muted-foreground/40 hover:text-muted-foreground shrink-0 transition-colors"
                            >
                              <GripVertical className="h-4 w-4" />
                            </div>

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
                              className={`h-8 w-8 shrink-0 p-0 ${ch.is_locked ? "text-warning hover:text-warning" : "text-muted-foreground"}`}
                              onClick={() => toggleLock(ch)}
                              title={ch.is_locked ? "Unlock chapter" : "Lock chapter"}
                            >
                              {ch.is_locked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
                            </Button>

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
                      )}
                    </Draggable>
                  )
                })}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
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
