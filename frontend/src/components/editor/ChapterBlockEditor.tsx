import { useCallback, useEffect, useState } from "react"
import { Label } from "@/components/ui/label"
import { Loader2 } from "lucide-react"
import { coursesService } from "@/services/courses"
import { getErrorDetail } from "@/lib/errorDetail"
import { toast } from "@/lib/toast"
import type { ChapterBlock } from "@/types"
import { useConfirm } from "@/components/ui/alert-dialog"
import { AddBlockMenu, BlockRow, type BlockType } from "./blocks"

interface Props {
  chapterId: string
}

/**
 * Teacher-facing list of content blocks for a chapter. Thin
 * orchestrator: owns the list + which block is expanded + the drag
 * state for reordering, and delegates each row (and every type of
 * per-block editor) to `./blocks/`.
 */
export default function ChapterBlockEditor({ chapterId }: Props) {
  const confirm = useConfirm()
  const [blocks, setBlocks] = useState<ChapterBlock[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null)

  const load = useCallback(
    async (signal?: { cancelled: boolean }) => {
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
    },
    [chapterId],
  )

  useEffect(() => {
    const signal = { cancelled: false }
    void load(signal)
    return () => {
      signal.cancelled = true
    }
  }, [load])

  const addBlock = async (type: BlockType) => {
    setAdding(true)
    try {
      const newBlock = await coursesService.createBlock(chapterId, {
        block_type: type,
        order_index: blocks.length,
      })
      setBlocks((prev) => [...prev, newBlock])
      setExpandedId(newBlock.id)
      toast({ title: `${type} block added`, variant: "success" })
    } catch (error: unknown) {
      const detail = getErrorDetail(error) || "Unknown error"
      toast({ title: `Failed to add block: ${detail}`, variant: "destructive" })
    } finally {
      setAdding(false)
    }
  }

  const replaceBlock = (updated: ChapterBlock) => {
    setBlocks((prev) => prev.map((b) => (b.id === updated.id ? updated : b)))
  }

  const deleteBlock = async (id: string) => {
    const ok = await confirm({
      title: "Delete this block?",
      confirmLabel: "Delete",
      tone: "destructive",
    })
    if (!ok) return
    try {
      await coursesService.deleteBlock(id)
      setBlocks((prev) => prev.filter((b) => b.id !== id))
      if (expandedId === id) setExpandedId(null)
      toast({ title: "Block deleted", variant: "success" })
    } catch {
      toast({ title: "Failed to delete block", variant: "destructive" })
    }
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
    const withIndex = reordered.map((b, i) => ({ ...b, order_index: i }))
    setBlocks(withIndex)
    setDragIdx(null)
    setDragOverIdx(null)

    try {
      await coursesService.reorderBlocks(
        chapterId,
        withIndex.map((b) => ({ id: b.id, order_index: b.order_index })),
      )
    } catch {
      toast({ title: "Failed to reorder blocks", variant: "destructive" })
      void load()
    }
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
        <span className="text-xs text-muted-foreground">
          {blocks.length} block{blocks.length !== 1 ? "s" : ""}
        </span>
      </div>

      {blocks.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4 border border-dashed rounded-md">
          No blocks yet. Add your first content block below.
        </p>
      )}

      <div className="space-y-2">
        {blocks.map((block, idx) => (
          <BlockRow
            key={block.id}
            block={block}
            chapterId={chapterId}
            index={idx}
            expanded={expandedId === block.id}
            isDragOver={dragOverIdx === idx}
            onExpandToggle={() =>
              setExpandedId((prev) => (prev === block.id ? null : block.id))
            }
            onDelete={() => deleteBlock(block.id)}
            onBlockUpdated={replaceBlock}
            onDragStart={() => setDragIdx(idx)}
            onDragOver={(e) => {
              e.preventDefault()
              setDragOverIdx(idx)
            }}
            onDrop={() => handleDrop(idx)}
            onDragEnd={() => {
              setDragIdx(null)
              setDragOverIdx(null)
            }}
          />
        ))}
      </div>

      <AddBlockMenu onAdd={addBlock} adding={adding} />
    </div>
  )
}
