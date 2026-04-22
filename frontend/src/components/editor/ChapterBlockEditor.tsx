import { useEffect, useState, useCallback, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import RichTextEditor from "./RichTextEditor"
import { coursesService } from "@/services/courses"
import { getErrorDetail } from "@/lib/errorDetail"
import type { ChapterBlock } from "@/types"
import { toast } from "@/hooks/use-toast"
import {
  Plus, Trash2, GripVertical, Save, Video, FileText,
  ChevronDown, ChevronRight, Loader2, Type, Film,
  HelpCircle, ClipboardList, Paperclip, Check,
} from "lucide-react"
import QuizEditor from "@/components/quiz/QuizEditor"
import AssignmentEditor from "@/components/assignment/AssignmentEditor"
import { useConfirm } from "@/components/ui/alert-dialog"

const BLOCK_TYPES = [
  { value: "text", label: "Text", icon: Type },
  { value: "video", label: "Video", icon: Film },
  { value: "quiz", label: "Quiz", icon: HelpCircle },
  { value: "assignment", label: "Assignment", icon: ClipboardList },
  { value: "file", label: "File", icon: Paperclip },
] as const

type BlockType = (typeof BLOCK_TYPES)[number]["value"]

interface Props {
  chapterId: string
}

export default function ChapterBlockEditor({ chapterId }: Props) {
  const confirm = useConfirm()
  const [blocks, setBlocks] = useState<ChapterBlock[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedBlock, setExpandedBlock] = useState<string | null>(null)
  const [savingBlock, setSavingBlock] = useState<string | null>(null)
  const [showAddMenu, setShowAddMenu] = useState(false)
  const [addingBlock, setAddingBlock] = useState(false)
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null)

  const [editContent, setEditContent] = useState("")
  const [editVideoUrl, setEditVideoUrl] = useState("")
  const [editFileUrl, setEditFileUrl] = useState("")
  const [autoSaveStatus, setAutoSaveStatus] = useState<"idle" | "pending" | "saving" | "saved">("idle")
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const savedResetTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const editContentRef = useRef("")
  const mountedRef = useRef(true)

  const loadBlocks = useCallback(async (signal?: { cancelled: boolean }) => {
    try {
      const data = await coursesService.getChapterBlocks(chapterId)
      if (signal?.cancelled) return
      setBlocks(data.sort((a, b) => a.order_index - b.order_index))
    } catch (error: unknown) {
      if (signal?.cancelled) return
      const detail = getErrorDetail(error)
      if (detail) {
        toast({ title: `Failed to load blocks: ${detail}`, variant: "destructive" })
      }
    } finally {
      if (!signal?.cancelled) setLoading(false)
    }
  }, [chapterId])

  useEffect(() => {
    const signal = { cancelled: false }
    loadBlocks(signal)
    return () => { signal.cancelled = true }
  }, [loadBlocks])

  const addBlock = async (type: BlockType) => {
    setAddingBlock(true)
    setShowAddMenu(false)
    try {
      const newBlock = await coursesService.createBlock(chapterId, {
        block_type: type,
        order_index: blocks.length,
      })
      setBlocks((prev) => [...prev, newBlock])
      setExpandedBlock(newBlock.id)
      initEditState(newBlock)
      toast({ title: `${type} block added`, variant: "success" })
    } catch (error: unknown) {
      const detail = getErrorDetail(error) || "Unknown error"
      toast({ title: `Failed to add block: ${detail}`, variant: "destructive" })
    } finally {
      setAddingBlock(false)
    }
  }

  const initEditState = (block: ChapterBlock) => {
    setEditContent(block.content ?? "")
    editContentRef.current = block.content ?? ""
    setEditVideoUrl(block.video_url ?? "")
    setEditFileUrl(block.file_url ?? "")
  }

  const updateBlockField = async (blockId: string, field: string, value: string) => {
    try {
      const updated = await coursesService.updateBlock(blockId, { [field]: value })
      setBlocks((prev) => prev.map((b) => (b.id === blockId ? updated : b)))
    } catch {
      toast({ title: "Failed to update block", variant: "destructive" })
    }
  }

  const scheduleAutoSave = useCallback((block: ChapterBlock) => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
    if (savedResetTimer.current) clearTimeout(savedResetTimer.current)
    setAutoSaveStatus("pending")
    const blockId = block.id
    const snapshot = editContentRef.current
    autoSaveTimer.current = setTimeout(async () => {
      if (!mountedRef.current) return
      // Defer the write while the tab is hidden: saving will happen the
      // next time the user is typing (or on explicit save). This avoids
      // background tabs hammering the API for no user benefit.
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        setAutoSaveStatus("pending")
        return
      }
      setAutoSaveStatus("saving")
      try {
        const updated = await coursesService.updateBlock(blockId, { content: snapshot })
        if (!mountedRef.current) return
        setBlocks((prev) => prev.map((b) => (b.id === blockId ? updated : b)))
        setAutoSaveStatus("saved")
        savedResetTimer.current = setTimeout(() => {
          if (mountedRef.current) setAutoSaveStatus("idle")
        }, 2000)
      } catch {
        if (!mountedRef.current) return
        setAutoSaveStatus("idle")
        toast({ title: "Auto-save failed", variant: "destructive" })
      }
    }, 2000)
  }, [])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
      if (savedResetTimer.current) clearTimeout(savedResetTimer.current)
    }
  }, [])

  const saveBlock = async (block: ChapterBlock) => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
    if (savedResetTimer.current) clearTimeout(savedResetTimer.current)
    setAutoSaveStatus("idle")
    setSavingBlock(block.id)
    try {
      const payload: Partial<ChapterBlock> = {}
      if (block.block_type === "text") payload.content = editContent
      if (block.block_type === "video") payload.video_url = editVideoUrl.trim() || null
      if (block.block_type === "file") payload.file_url = editFileUrl.trim() || null

      const updated = await coursesService.updateBlock(block.id, payload)
      setBlocks((prev) => prev.map((b) => (b.id === block.id ? updated : b)))
      toast({ title: "Block saved", variant: "success" })
    } catch {
      toast({ title: "Failed to save block", variant: "destructive" })
    } finally {
      setSavingBlock(null)
    }
  }

  const deleteBlock = async (blockId: string) => {
    const ok = await confirm({
      title: "Delete this block?",
      confirmLabel: "Delete",
      tone: "destructive",
    })
    if (!ok) return
    try {
      await coursesService.deleteBlock(blockId)
      setBlocks((prev) => prev.filter((b) => b.id !== blockId))
      if (expandedBlock === blockId) setExpandedBlock(null)
      toast({ title: "Block deleted", variant: "success" })
    } catch {
      toast({ title: "Failed to delete block", variant: "destructive" })
    }
  }

  const handleDragStart = (idx: number) => {
    setDragIdx(idx)
  }

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault()
    setDragOverIdx(idx)
  }

  const handleDrop = async (targetIdx: number) => {
    if (dragIdx === null || dragIdx === targetIdx) {
      setDragIdx(null)
      setDragOverIdx(null)
      return
    }
    const reordered = [...blocks]
    const [moved] = reordered.splice(dragIdx, 1)
    if (!moved) return
    reordered.splice(targetIdx, 0, moved)
    const updated = reordered.map((b, i) => ({ ...b, order_index: i }))
    setBlocks(updated)
    setDragIdx(null)
    setDragOverIdx(null)

    try {
      await coursesService.reorderBlocks(chapterId, updated.map((b) => ({ id: b.id, order_index: b.order_index })))
    } catch {
      toast({ title: "Failed to reorder blocks", variant: "destructive" })
      loadBlocks()
    }
  }

  const blockIcon = (type: string) => {
    const found = BLOCK_TYPES.find((bt) => bt.value === type)
    if (!found) return FileText
    return found.icon
  }

  const blockLabel = (type: string) => {
    const found = BLOCK_TYPES.find((bt) => bt.value === type)
    return found?.label ?? type
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Content Blocks
        </Label>
        <span className="text-xs text-muted-foreground">{blocks.length} block{blocks.length !== 1 ? "s" : ""}</span>
      </div>

      {blocks.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4 border border-dashed rounded-md">
          No blocks yet. Add your first content block below.
        </p>
      )}

      <div className="space-y-2">
        {blocks.map((block, idx) => {
          const Icon = blockIcon(block.block_type)
          const isExpanded = expandedBlock === block.id
          return (
            <div
              key={block.id}
              draggable
              onDragStart={() => handleDragStart(idx)}
              onDragOver={(e) => handleDragOver(e, idx)}
              onDrop={() => handleDrop(idx)}
              onDragEnd={() => { setDragIdx(null); setDragOverIdx(null) }}
              className={`rounded-md border transition-colors ${
                dragOverIdx === idx ? "border-primary bg-primary/5" : "bg-background"
              }`}
            >
              <div
                className="flex items-center gap-2 px-3 py-2 cursor-pointer select-none"
                onClick={() => {
                  if (isExpanded) {
                    setExpandedBlock(null)
                  } else {
                    setExpandedBlock(block.id)
                    initEditState(block)
                  }
                }}
              >
                <GripVertical className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0 cursor-grab" />
                {isExpanded ? (
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                )}
                <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="text-sm font-medium flex-1">{blockLabel(block.block_type)}</span>
                <span className="text-[10px] text-muted-foreground">#{idx + 1}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 text-destructive hover:text-destructive shrink-0"
                  onClick={(e) => {
                    e.stopPropagation()
                    deleteBlock(block.id)
                  }}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>

              {isExpanded && (
                <div className="border-t px-3 py-3 space-y-3">
                  {block.block_type === "text" && (
                    <>
                      <RichTextEditor
                        content={editContent}
                        onChange={(html) => {
                          setEditContent(html)
                          editContentRef.current = html
                          scheduleAutoSave(block)
                        }}
                        placeholder="Write block content..."
                      />
                      <div className="flex items-center gap-3">
                        <Button
                          size="sm"
                          onClick={() => saveBlock(block)}
                          disabled={savingBlock === block.id}
                        >
                          {savingBlock === block.id ? (
                            <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                          ) : (
                            <Save className="h-3.5 w-3.5 mr-1.5" />
                          )}
                          Save Text
                        </Button>
                        {autoSaveStatus === "pending" && (
                          <span className="text-xs text-muted-foreground animate-pulse">
                            Unsaved changes...
                          </span>
                        )}
                        {autoSaveStatus === "saving" && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            Auto-saving...
                          </span>
                        )}
                        {autoSaveStatus === "saved" && (
                          <span className="flex items-center gap-1 text-xs text-success">
                            <Check className="h-3 w-3" />
                            Saved
                          </span>
                        )}
                      </div>
                    </>
                  )}

                  {block.block_type === "video" && (
                    <>
                      <div className="space-y-1.5">
                        <Label className="text-xs flex items-center gap-1.5">
                          <Video className="h-3.5 w-3.5" />
                          Video URL
                        </Label>
                        <Input
                          value={editVideoUrl}
                          onChange={(e) => setEditVideoUrl(e.target.value)}
                          placeholder="https://www.youtube.com/watch?v=..."
                          className="h-8 text-sm"
                        />
                      </div>
                      <Button
                        size="sm"
                        onClick={() => saveBlock(block)}
                        disabled={savingBlock === block.id}
                      >
                        {savingBlock === block.id ? (
                          <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                        ) : (
                          <Save className="h-3.5 w-3.5 mr-1.5" />
                        )}
                        Save Video
                      </Button>
                    </>
                  )}

                  {block.block_type === "quiz" && (
                    <QuizEditor
                      chapterId={chapterId}
                      onQuizSaved={(quizId) => updateBlockField(block.id, "quiz_id", quizId)}
                    />
                  )}

                  {block.block_type === "assignment" && (
                    <AssignmentEditor
                      chapterId={chapterId}
                      onAssignmentCreated={(id) => updateBlockField(block.id, "assignment_id", id)}
                    />
                  )}

                  {block.block_type === "file" && (
                    <>
                      <div className="space-y-1.5">
                        <Label className="text-xs flex items-center gap-1.5">
                          <Paperclip className="h-3.5 w-3.5" />
                          File URL
                        </Label>
                        <Input
                          value={editFileUrl}
                          onChange={(e) => setEditFileUrl(e.target.value)}
                          placeholder="https://..."
                          className="h-8 text-sm"
                        />
                      </div>
                      <Button
                        size="sm"
                        onClick={() => saveBlock(block)}
                        disabled={savingBlock === block.id}
                      >
                        {savingBlock === block.id ? (
                          <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                        ) : (
                          <Save className="h-3.5 w-3.5 mr-1.5" />
                        )}
                        Save File
                      </Button>
                    </>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Add Block button with dropdown */}
      <div className="relative">
        <Button
          variant="outline"
          size="sm"
          className="w-full border-dashed"
          onClick={() => setShowAddMenu(!showAddMenu)}
          disabled={addingBlock}
        >
          {addingBlock ? (
            <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
          ) : (
            <Plus className="h-3.5 w-3.5 mr-1.5" />
          )}
          Add Block
        </Button>
        {showAddMenu && (
          <div className="absolute z-10 mt-1 w-full bg-background border rounded-md shadow-lg py-1">
            {BLOCK_TYPES.map((bt) => {
              const Icon = bt.icon
              return (
                <button
                  key={bt.value}
                  onClick={() => addBlock(bt.value)}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-muted transition-colors text-left"
                >
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  {bt.label}
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
