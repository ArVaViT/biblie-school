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
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={
          minWords
            ? `Write at least ${minWords} words. Your response will be reviewed by the teacher.`
            : "Write your essay response…"
        }
        className="w-full min-h-[220px] p-3 text-sm bg-background border rounded-md resize-y focus:outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground/50"
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
