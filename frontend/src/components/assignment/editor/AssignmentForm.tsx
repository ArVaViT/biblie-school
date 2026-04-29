import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Loader2, Save, X } from "lucide-react"
import type { AssignmentFormState } from "./types"

interface Props {
  value: AssignmentFormState
  onChange: (next: AssignmentFormState) => void
  onSubmit: () => void
  onCancel: () => void
  submitting: boolean
  mode: "create" | "edit"
}

/**
 * Shared form used for both creating a new assignment and editing an
 * existing one. The original file duplicated the markup twice — this
 * component collapses that into a single source of truth.
 */
export function AssignmentForm({ value, onChange, onSubmit, onCancel, submitting, mode }: Props) {
  const patch = (p: Partial<AssignmentFormState>) => onChange({ ...value, ...p })

  const submitLabel =
    mode === "create"
      ? submitting
        ? "Creating..."
        : "Create Assignment"
      : submitting
        ? "Updating..."
        : "Update Assignment"

  return (
    <Card className="bg-muted/30">
      <CardContent className="p-4 space-y-3">
        <div className="space-y-1.5">
          <Label className="text-xs" htmlFor="assignment-title">
            Title
          </Label>
          <Input
            id="assignment-title"
            value={value.title}
            onChange={(e) => patch({ title: e.target.value })}
            placeholder="e.g. Chapter Reflection Essay"
            fieldSize="sm"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs" htmlFor="assignment-description">
            Description (optional)
          </Label>
          <Textarea
            id="assignment-description"
            value={value.description}
            onChange={(e) => patch({ description: e.target.value })}
            placeholder="Assignment instructions..."
            fieldSize="sm"
          />
        </div>
        <div className="flex gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs" htmlFor="assignment-max-score">
              Max Score
            </Label>
            <Input
              id="assignment-max-score"
              type="number"
              min={1}
              value={value.maxScore}
              onChange={(e) => patch({ maxScore: Number(e.target.value) || 100 })}
              fieldSize="sm"
              className="w-24"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs" htmlFor="assignment-due">
              Due Date (optional)
            </Label>
            <Input
              id="assignment-due"
              type="date"
              value={value.dueDate}
              onChange={(e) => patch({ dueDate: e.target.value })}
              fieldSize="sm"
            />
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={onSubmit} disabled={submitting}>
            {submitting ? (
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5 mr-1.5" />
            )}
            {submitLabel}
          </Button>
          <Button size="sm" variant="ghost" onClick={onCancel}>
            {mode === "edit" && <X className="h-3.5 w-3.5 mr-1.5" />}
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
