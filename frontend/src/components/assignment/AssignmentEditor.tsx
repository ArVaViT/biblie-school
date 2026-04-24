import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { FileText, Loader2, Plus } from "lucide-react"
import { useConfirm } from "@/components/ui/alert-dialog"
import { coursesService } from "@/services/courses"
import { toast } from "@/lib/toast"
import type { Assignment } from "@/types"
import {
  AssignmentForm,
  AssignmentItem,
  EMPTY_ASSIGNMENT_FORM,
  formStateToPayload,
  type AssignmentFormState,
} from "./editor"

interface AssignmentEditorProps {
  chapterId: string
  onAssignmentCreated?: (assignmentId: string) => void
}

/**
 * Teacher-facing list of assignments for a chapter. Thin orchestrator:
 * owns the list + "create" form state, and delegates each row (with its
 * edit form and submissions grader) to `AssignmentItem`.
 */
export default function AssignmentEditor({
  chapterId,
  onAssignmentCreated,
}: AssignmentEditorProps) {
  const confirm = useConfirm()
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState(false)

  const [form, setForm] = useState<AssignmentFormState>(EMPTY_ASSIGNMENT_FORM)
  const [creating, setCreating] = useState(false)
  const [showCreate, setShowCreate] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setFetchError(false)
    coursesService
      .getChapterAssignments(chapterId)
      .then((data) => {
        if (!cancelled) setAssignments(data)
      })
      .catch(() => {
        if (!cancelled) setFetchError(true)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [chapterId])

  const handleCreate = async () => {
    if (!form.title.trim()) {
      toast({ title: "Assignment title is required", variant: "destructive" })
      return
    }
    setCreating(true)
    try {
      const a = await coursesService.createAssignment({
        chapter_id: chapterId,
        ...formStateToPayload(form),
      })
      setAssignments((prev) => [...prev, a])
      onAssignmentCreated?.(a.id)
      setForm(EMPTY_ASSIGNMENT_FORM)
      setShowCreate(false)
      toast({ title: "Assignment created", variant: "success" })
    } catch {
      toast({ title: "Failed to create assignment", variant: "destructive" })
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (id: string) => {
    const ok = await confirm({
      title: "Delete this assignment?",
      description: "All student submissions will also be deleted.",
      confirmLabel: "Delete assignment",
      tone: "destructive",
    })
    if (!ok) return
    try {
      await coursesService.deleteAssignment(id)
      setAssignments((prev) => prev.filter((a) => a.id !== id))
      toast({ title: "Assignment deleted", variant: "success" })
    } catch {
      toast({ title: "Failed to delete assignment", variant: "destructive" })
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (fetchError) {
    return (
      <p className="text-sm text-destructive py-4 text-center">
        Failed to load assignments. Please try refreshing.
      </p>
    )
  }

  return (
    <div className="space-y-4 mt-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Assignments ({assignments.length})</span>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          onClick={() => setShowCreate((v) => !v)}
        >
          <Plus className="h-3 w-3 mr-1" />
          New Assignment
        </Button>
      </div>

      {showCreate && (
        <AssignmentForm
          value={form}
          onChange={setForm}
          onSubmit={handleCreate}
          onCancel={() => setShowCreate(false)}
          submitting={creating}
          mode="create"
        />
      )}

      {assignments.map((a) => (
        <AssignmentItem
          key={a.id}
          assignment={a}
          onDelete={handleDelete}
          onUpdate={(updated) =>
            setAssignments((prev) => prev.map((x) => (x.id === updated.id ? updated : x)))
          }
        />
      ))}

      {assignments.length === 0 && !showCreate && (
        <div className="text-center py-6 border border-dashed rounded-md text-sm text-muted-foreground">
          No assignments for this chapter.
        </div>
      )}
    </div>
  )
}
