import { Modal } from "@/components/patterns"
import { Button } from "@/components/ui/button"
import type { Cohort } from "@/types"
import { formatDate } from "./types"

interface Props {
  open: boolean
  onClose: () => void
  cohorts: Cohort[]
  selectedCohortId: string | null
  onSelect: (id: string) => void
  onConfirm: () => void
  enrolling: boolean
}

export function CohortSelectModal({
  open,
  onClose,
  cohorts,
  selectedCohortId,
  onSelect,
  onConfirm,
  enrolling,
}: Props) {
  return (
    <Modal open={open} onClose={onClose} title="Select a Cohort">
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Multiple cohorts are available. Choose one to enroll in:
        </p>
        {cohorts.map((cohort) => (
          <label
            key={cohort.id}
            className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
              selectedCohortId === cohort.id
                ? "border-primary bg-primary/5"
                : "hover:bg-muted/50"
            }`}
          >
            <input
              type="radio"
              name="cohort"
              checked={selectedCohortId === cohort.id}
              onChange={() => onSelect(cohort.id)}
              className="accent-primary"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{cohort.name}</p>
              <p className="text-xs text-muted-foreground">
                {formatDate(cohort.start_date)} &mdash; {formatDate(cohort.end_date)}
              </p>
              {cohort.max_students && (
                <p className="text-xs text-muted-foreground">
                  {cohort.student_count}/{cohort.max_students} spots filled
                </p>
              )}
            </div>
          </label>
        ))}
        <Button
          onClick={onConfirm}
          disabled={!selectedCohortId || enrolling}
          className="w-full"
        >
          {enrolling ? "Enrolling..." : "Enroll"}
        </Button>
      </div>
    </Modal>
  )
}
