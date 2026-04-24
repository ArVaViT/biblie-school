import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface Props {
  title: string
  setTitle: (v: string) => void
  description: string
  setDescription: (v: string) => void
  passingScore: number
  setPassingScore: (v: number) => void
  maxAttempts: number
  setMaxAttempts: (v: number) => void
  chapterType: "quiz" | "exam"
}

export function QuizHeaderFields({
  title,
  setTitle,
  description,
  setDescription,
  passingScore,
  setPassingScore,
  maxAttempts,
  setMaxAttempts,
  chapterType,
}: Props) {
  return (
    <div className="grid gap-3">
      <div className="space-y-1.5">
        <Label className="text-xs">Quiz Title</Label>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Chapter Review Quiz"
          className="h-8 text-sm"
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Description (optional)</Label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Brief description of the quiz..."
          className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y"
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Passing Score (%)</Label>
        <Input
          type="number"
          min={0}
          max={100}
          value={passingScore}
          onChange={(e) => setPassingScore(Number(e.target.value))}
          className="h-8 text-sm w-28"
        />
      </div>
      {chapterType === "exam" && (
        <div className="space-y-1.5">
          <Label className="text-xs">Maximum Attempts</Label>
          <Input
            type="number"
            min={1}
            max={10}
            value={maxAttempts}
            onChange={(e) =>
              setMaxAttempts(Math.min(10, Math.max(1, Number(e.target.value) || 1)))
            }
            className="h-8 text-sm w-28"
          />
        </div>
      )}
    </div>
  )
}
