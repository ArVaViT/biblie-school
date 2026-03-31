import { useState, useEffect, useRef, useCallback } from "react"
import { coursesService } from "@/services/courses"
import { StickyNote, ChevronDown, ChevronRight, Check } from "lucide-react"

interface StudentNotesProps {
  chapterId: string
}

export default function StudentNotes({ chapterId }: StudentNotesProps) {
  const [content, setContent] = useState("")
  const [isOpen, setIsOpen] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoaded(false)
    setContent("")
    setSaved(false)
    coursesService.getNote(chapterId).then((note) => {
      if (!cancelled) {
        setContent(note?.content ?? "")
        setLoaded(true)
      }
    }).catch(() => {
      if (!cancelled) setLoaded(true)
    })
    return () => { cancelled = true }
  }, [chapterId])

  const save = useCallback(async (text: string) => {
    if (!loaded) return
    try {
      if (text.trim()) {
        await coursesService.saveNote(chapterId, text)
      } else {
        await coursesService.deleteNote(chapterId)
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch {
      // save failed silently — will retry on next autosave
    }
  }, [chapterId, loaded])

  const handleChange = (value: string) => {
    setContent(value)
    setSaved(false)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => save(value), 1500)
  }

  return (
    <div className="border rounded-lg bg-card mt-4">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 w-full px-4 py-3 text-sm font-medium text-left hover:bg-muted/50 transition-colors rounded-lg"
        aria-expanded={isOpen}
      >
        {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        <StickyNote className="h-4 w-4 text-amber-500" />
        <span>My Notes</span>
        {saved && (
          <span className="ml-auto flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
            <Check className="h-3 w-3" /> Saved
          </span>
        )}
        {content && !isOpen && (
          <span className="ml-auto text-xs text-muted-foreground truncate max-w-[200px]">
            {content.slice(0, 50)}{content.length > 50 ? "..." : ""}
          </span>
        )}
      </button>
      {isOpen && (
        <div className="px-4 pb-4">
          <textarea
            value={content}
            onChange={(e) => handleChange(e.target.value)}
            placeholder="Write your notes here... They auto-save as you type."
            className="w-full min-h-[120px] p-3 text-sm bg-muted/30 border rounded-md resize-y focus:outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground/50"
          />
        </div>
      )}
    </div>
  )
}
