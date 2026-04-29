import { Textarea } from "@/components/ui/textarea"

interface Props {
  value: string
  minWords: number | null
  onChange: (text: string) => void
}

export function EssayAnswer({ value, minWords, onChange }: Props) {
  const words = value.trim() ? value.trim().split(/\s+/).filter(Boolean).length : 0
  const minReached = !minWords || words >= minWords
  return (
    <div className="ml-8 space-y-1.5">
      <Textarea
        fieldSize="default"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={
          minWords
            ? `Write at least ${minWords} words. Your response will be reviewed by the teacher.`
            : "Write your essay response…"
        }
        className="min-h-[220px]"
      />
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">Essay · graded by the teacher</span>
        <span className={minReached ? "text-muted-foreground" : "text-warning font-medium"}>
          {words} word{words === 1 ? "" : "s"}
          {minWords ? ` / ${minWords} required` : ""}
        </span>
      </div>
    </div>
  )
}
