import { useEffect, useState, useCallback } from "react"
import { useParams, Link, useNavigate } from "react-router-dom"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import RichTextEditor from "@/components/editor/RichTextEditor"
import ChapterBlockEditor from "@/components/editor/ChapterBlockEditor"
import QuizEditor from "@/components/quiz/QuizEditor"
import AssignmentEditor from "@/components/assignment/AssignmentEditor"
import { coursesService } from "@/services/courses"
import type { Chapter } from "@/types"
import { toast } from "@/hooks/use-toast"
import {
  ChevronRight, Save, FileText, PlayCircle, Headphones,
  HelpCircle, ClipboardList, MessageSquare, Puzzle, Loader2, GraduationCap,
  ArrowLeft,
} from "lucide-react"

const CHAPTER_TYPES = [
  { value: "reading", label: "Reading", icon: FileText, desc: "Text lesson with rich formatting" },
  { value: "video", label: "Video", icon: PlayCircle, desc: "Video lesson with optional notes" },
  { value: "audio", label: "Audio", icon: Headphones, desc: "Audio lesson with transcript" },
  { value: "quiz", label: "Quiz", icon: HelpCircle, desc: "Test student knowledge" },
  { value: "exam", label: "Exam", icon: GraduationCap, desc: "Final assessment with attempts limit" },
  { value: "assignment", label: "Assignment", icon: ClipboardList, desc: "Submit work for grading" },
  { value: "discussion", label: "Discussion", icon: MessageSquare, desc: "Student discussion prompt" },
  { value: "mixed", label: "Mixed", icon: Puzzle, desc: "Combine multiple content types" },
] as const

type ChapterType = (typeof CHAPTER_TYPES)[number]["value"]
type ChapterUpdatePayload = Parameters<typeof coursesService.updateChapter>[3]

function getErrorDetail(error: unknown): string | undefined {
  if (
    typeof error === "object" &&
    error !== null &&
    "response" in error &&
    typeof (error as { response?: unknown }).response === "object"
  ) {
    const response = (error as { response?: { data?: { detail?: unknown } } }).response
    if (typeof response?.data?.detail === "string") {
      return response.data.detail
    }
  }

  return undefined
}

export default function ChapterEditor() {
  const { courseId, moduleId, chapterId } = useParams<{
    courseId: string
    moduleId: string
    chapterId: string
  }>()
  const navigate = useNavigate()

  const [chapter, setChapter] = useState<Chapter | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [title, setTitle] = useState("")
  const [chapterType, setChapterType] = useState<ChapterType>("reading")
  const [content, setContent] = useState("")
  const [videoUrl, setVideoUrl] = useState("")
  const [moduleName, setModuleName] = useState("Module")
  const [isDirty, setIsDirty] = useState(false)

  const load = useCallback(async () => {
    if (!courseId || !moduleId || !chapterId) return
    setLoading(true)
    try {
      const mod = await coursesService.getModule(courseId, moduleId)
      setModuleName(mod.title)
      const ch = mod.chapters?.find((c) => c.id === chapterId)
      if (!ch) {
        toast({ title: "Chapter not found", variant: "destructive" })
        navigate(`/teacher/courses/${courseId}/modules/${moduleId}/edit`)
        return
      }
      setChapter(ch)
      setTitle(ch.title)
      const type = (ch.chapter_type || "reading") as ChapterType
      const resolvedType = CHAPTER_TYPES.some((t) => t.value === type) ? type : "reading"
      setChapterType(resolvedType)
      setContent(ch.content ?? "")
      setVideoUrl(ch.video_url ?? "")
      setInitialSnapshot(JSON.stringify({
        title: ch.title,
        chapterType: resolvedType,
        content: ch.content ?? "",
        videoUrl: ch.video_url ?? "",
      }))
      setIsDirty(false)
    } catch {
      toast({ title: "Failed to load chapter", variant: "destructive" })
      navigate(`/teacher/courses/${courseId}/modules/${moduleId}/edit`)
    } finally {
      setLoading(false)
    }
  }, [courseId, moduleId, chapterId, navigate])

  useEffect(() => {
    load()
  }, [load])

  const [initialSnapshot, setInitialSnapshot] = useState("")

  useEffect(() => {
    if (!chapter) return
    const snapshot = JSON.stringify({ title, chapterType, content, videoUrl })
    if (!initialSnapshot) {
      setInitialSnapshot(snapshot)
      return
    }
    setIsDirty(snapshot !== initialSnapshot)
  }, [chapter, title, chapterType, content, videoUrl, initialSnapshot])

  useEffect(() => {
    if (!isDirty) return
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
    }
    window.addEventListener("beforeunload", handleBeforeUnload)
    return () => window.removeEventListener("beforeunload", handleBeforeUnload)
  }, [isDirty])

  const save = useCallback(async () => {
    if (!courseId || !moduleId || !chapterId || !title.trim()) return
    setSaving(true)
    try {
      const payload: ChapterUpdatePayload = {
        title: title.trim(),
        chapter_type: chapterType,
      }

      if (chapterType === "reading" || chapterType === "discussion") {
        payload.content = content
      } else if (chapterType === "video") {
        payload.video_url = videoUrl.trim() || undefined
        payload.content = content
      } else if (chapterType === "audio") {
        payload.video_url = videoUrl.trim() || undefined
        payload.content = content
      }

      await coursesService.updateChapter(courseId, moduleId, chapterId, payload)
      setIsDirty(false)
      toast({ title: "Chapter saved", variant: "success" })
      navigate(`/teacher/courses/${courseId}/modules/${moduleId}/edit`)
    } catch (error: unknown) {
      const detail = getErrorDetail(error) || "Unknown error"
      toast({ title: `Failed to save: ${detail}`, variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }, [courseId, moduleId, chapterId, title, chapterType, content, videoUrl, navigate])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault()
        save()
      }
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [save])

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="h-5 w-48 bg-muted rounded animate-pulse mb-6" />
        <div className="h-10 w-3/4 bg-muted rounded animate-pulse mb-4" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-6">
          {[1, 2, 3, 4, 5, 6, 7].map((i) => (
            <div key={i} className="h-24 bg-muted rounded-lg animate-pulse" />
          ))}
        </div>
        <div className="h-64 bg-muted rounded animate-pulse" />
      </div>
    )
  }

  if (!chapter) return null

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Breadcrumb */}
      <div className="mb-6 flex items-center gap-2 text-sm text-muted-foreground">
        <Link to="/teacher" className="hover:text-foreground transition-colors">
          My Courses
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <Link
          to={`/teacher/courses/${courseId}`}
          className="hover:text-foreground transition-colors"
        >
          Course
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <Link
          to={`/teacher/courses/${courseId}/modules/${moduleId}/edit`}
          className="hover:text-foreground transition-colors"
        >
          {moduleName}
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-foreground font-medium truncate max-w-[200px]">
          {title || "Chapter"}
        </span>
      </div>

      {/* Back button + title row */}
      <div className="flex items-center gap-3 mb-6">
        <Button
          variant="ghost"
          size="sm"
          className="shrink-0"
          onClick={() => {
            if (isDirty && !confirm("You have unsaved changes. Leave anyway?")) return
            navigate(`/teacher/courses/${courseId}/modules/${moduleId}/edit`)
          }}
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back
        </Button>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="font-serif text-2xl font-bold border-none shadow-none hover:border-border/50 hover:shadow-sm focus-visible:ring-1 h-auto py-1 px-2 flex-1"
          placeholder="Chapter title"
        />
      </div>

      {/* Chapter Type Selector */}
      <div className="mb-6">
        <Label className="text-sm font-semibold mb-3 block">Chapter Type</Label>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {CHAPTER_TYPES.map((ct) => {
            const Icon = ct.icon
            const selected = chapterType === ct.value
            return (
              <button
                key={ct.value}
                onClick={() => setChapterType(ct.value)}
                className={`flex items-start gap-3 rounded-lg border-2 p-4 text-left transition-all ${
                  selected
                    ? "border-primary bg-primary/5 shadow-sm"
                    : "border-border hover:border-primary/30 hover:bg-muted/40"
                }`}
              >
                <Icon
                  className={`h-5 w-5 mt-0.5 shrink-0 ${
                    selected ? "text-primary" : "text-muted-foreground"
                  }`}
                />
                <div>
                  <div
                    className={`text-sm font-medium ${
                      selected ? "text-primary" : ""
                    }`}
                  >
                    {ct.label}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {ct.desc}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Type-specific editor */}
      <Card className="mb-6">
        <CardContent className="p-6 space-y-4">
          {chapterType === "reading" && (
            <>
              <Label className="text-sm font-semibold">Content</Label>
              <RichTextEditor
                content={content}
                onChange={setContent}
                placeholder="Write chapter content here..."
              />
            </>
          )}

          {chapterType === "video" && (
            <>
              <div className="space-y-1.5">
                <Label className="text-sm font-semibold flex items-center gap-1.5">
                  <PlayCircle className="h-4 w-4" />
                  Video URL
                </Label>
                <Input
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=..."
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-semibold">Notes (optional)</Label>
                <RichTextEditor
                  content={content}
                  onChange={setContent}
                  placeholder="Optional notes to accompany the video..."
                />
              </div>
            </>
          )}

          {chapterType === "audio" && (
            <>
              <div className="space-y-1.5">
                <Label className="text-sm font-semibold flex items-center gap-1.5">
                  <Headphones className="h-4 w-4" />
                  Audio URL
                </Label>
                <Input
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  placeholder="https://example.com/audio.mp3"
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-semibold">Transcript (optional)</Label>
                <Textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Paste or type the audio transcript here..."
                  rows={10}
                  className="text-sm"
                />
              </div>
            </>
          )}

          {(chapterType === "quiz" || chapterType === "exam") && (
            <QuizEditor chapterId={chapter.id} chapterType={chapterType} />
          )}

          {chapterType === "assignment" && (
            <AssignmentEditor chapterId={chapter.id} />
          )}

          {chapterType === "discussion" && (
            <>
              <Label className="text-sm font-semibold">Discussion Prompt</Label>
              <RichTextEditor
                content={content}
                onChange={setContent}
                placeholder="Write the discussion prompt and guidelines here..."
              />
            </>
          )}

          {chapterType === "mixed" && (
            <ChapterBlockEditor chapterId={chapter.id} />
          )}
        </CardContent>
      </Card>

      {/* Save button */}
      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={saving}>
          {saving ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          {saving ? "Saving..." : "Save Chapter"}
        </Button>
        <span className="text-xs text-muted-foreground">Ctrl+S to save</span>
      </div>
    </div>
  )
}
