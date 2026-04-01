import { useEffect, useState, useCallback, useMemo } from "react"
import { useParams, Link, useNavigate } from "react-router-dom"
import DOMPurify from "dompurify"

DOMPurify.addHook("uponSanitizeElement", (node, data) => {
  if (data.tagName === "iframe") {
    const src = (node as HTMLIFrameElement).getAttribute("src") || ""
    if (src.startsWith("https://www.youtube.com/embed/") || src.startsWith("https://www.youtube-nocookie.com/embed/")) {
      return
    }
    node.parentNode?.removeChild(node)
  }
})

const SANITIZE_CONFIG = {
  ADD_TAGS: ["iframe"],
  ADD_ATTR: [
    "allow", "allowfullscreen", "frameborder", "src", "loading",
    "referrerpolicy", "style", "data-callout", "data-youtube-embed",
    "alt", "width", "height",
  ],
}

function sanitize(html: string) {
  return DOMPurify.sanitize(html, SANITIZE_CONFIG)
}
import { Button } from "@/components/ui/button"
import { coursesService } from "@/services/courses"
import type { Module, Chapter, ChapterBlock } from "@/types"
import {
  ArrowLeft,
  ArrowRight,
  Book,
  CheckCircle,
  Circle,
  Lock,
  FileText,
  HelpCircle,
  GraduationCap,
  ClipboardList,
  PlayCircle,
  Headphones,
  MessageSquare,
  Layers,
  Download,
  File,
} from "lucide-react"
import { toast } from "@/hooks/use-toast"
import StudentNotes from "@/components/course/StudentNotes"
import QuizTaker from "@/components/quiz/QuizTaker"
import AssignmentPanel from "@/components/assignment/AssignmentPanel"

function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
    /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
  ]
  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match) return match[1]
  }
  return null
}

const CHAPTER_TYPE_CONFIG: Record<string, { label: string; icon: typeof FileText; color: string }> = {
  reading: { label: "Reading", icon: FileText, color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  content: { label: "Reading", icon: FileText, color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  video: { label: "Video", icon: PlayCircle, color: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400" },
  audio: { label: "Audio", icon: Headphones, color: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400" },
  quiz: { label: "Quiz", icon: HelpCircle, color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" },
  exam: { label: "Exam", icon: GraduationCap, color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
  assignment: { label: "Assignment", icon: ClipboardList, color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" },
  discussion: { label: "Discussion", icon: MessageSquare, color: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400" },
  mixed: { label: "Mixed", icon: Layers, color: "bg-gray-100 text-gray-700 dark:bg-gray-800/30 dark:text-gray-400" },
}

function ChapterTypeBadge({ type }: { type: string }) {
  const config = CHAPTER_TYPE_CONFIG[type] ?? CHAPTER_TYPE_CONFIG.reading
  const Icon = config.icon
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${config.color}`}>
      <Icon className="h-3.5 w-3.5" />
      {config.label}
    </span>
  )
}

function BlockRenderer({ block, onAssignmentSubmitted }: { block: ChapterBlock; onAssignmentSubmitted?: () => void }) {
  switch (block.block_type) {
    case "text":
      return block.content ? (
        <div
          className="prose prose-sm dark:prose-invert max-w-none"
          dangerouslySetInnerHTML={{ __html: sanitize(block.content) }}
        />
      ) : null

    case "video": {
      const videoId = block.video_url ? extractYouTubeId(block.video_url) : null
      if (videoId) {
        return (
          <div className="relative w-full overflow-hidden rounded-lg" style={{ paddingBottom: "56.25%" }}>
            <iframe
              className="absolute inset-0 h-full w-full"
              src={`https://www.youtube.com/embed/${videoId}`}
              title="Video"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        )
      }
      if (block.video_url) {
        return (
          <a href={block.video_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-primary hover:underline">
            <PlayCircle className="h-4 w-4" /> Open video in new tab
          </a>
        )
      }
      return null
    }

    case "quiz":
      return block.quiz_id ? <QuizTaker chapterId={block.chapter_id} /> : null

    case "assignment":
      return block.assignment_id ? <AssignmentPanel chapterId={block.chapter_id} onSubmitted={onAssignmentSubmitted} /> : null

    case "file":
      return block.file_url ? (
        <a
          href={block.file_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-muted/50 transition-colors"
        >
          <File className="h-4 w-4 text-muted-foreground" />
          <span>{block.content || "Download file"}</span>
          <Download className="h-3.5 w-3.5 text-muted-foreground" />
        </a>
      ) : null

    default:
      return null
  }
}

export default function ChapterView() {
  const { courseId, moduleId, chapterId } = useParams<{
    courseId: string
    moduleId: string
    chapterId: string
  }>()
  const navigate = useNavigate()

  const [mod, setMod] = useState<Module | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set())
  const [toggling, setToggling] = useState(false)
  const [chapterBlocks, setChapterBlocks] = useState<ChapterBlock[]>([])
  const [loadingBlocks, setLoadingBlocks] = useState(false)
  const [discussionResponse, setDiscussionResponse] = useState("")
  const [hasAssignments, setHasAssignments] = useState(false)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      if (!courseId || !moduleId) {
        setLoading(false)
        setError("Invalid course or module link.")
        return
      }
      setLoading(true)
      setError(null)
      try {
        const m = await coursesService.getModule(courseId, moduleId)
        if (cancelled) return
        setMod(m)

        try {
          const completedChapterIds = await coursesService.getMyChapterProgress(courseId)
          if (!cancelled) setCompletedIds(new Set(completedChapterIds))
        } catch {
          // non-critical
        }
      } catch {
        if (!cancelled) setError("Failed to load chapter. Please try again.")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [courseId, moduleId])

  const sortedChapters = useMemo(
    () => [...(mod?.chapters ?? [])].sort((a, b) => a.order_index - b.order_index),
    [mod],
  )

  const currentIdx = sortedChapters.findIndex((c) => c.id === chapterId)
  const chapter = currentIdx >= 0 ? sortedChapters[currentIdx] : null
  const prevChapter = currentIdx > 0 ? sortedChapters[currentIdx - 1] : null
  const nextChapter = currentIdx < sortedChapters.length - 1 ? sortedChapters[currentIdx + 1] : null

  useEffect(() => {
    if (!chapter) return
    let cancelled = false

    setDiscussionResponse("")
    setHasAssignments(false)

    const contentTypes = ["reading", "content", "video", "audio", "discussion", "mixed"]
    if (contentTypes.includes(chapter.chapter_type || "reading")) {
      setLoadingBlocks(true)
      coursesService
        .getChapterBlocks(chapter.id)
        .then((blocks) => {
          if (!cancelled)
            setChapterBlocks(blocks.sort((a: ChapterBlock, b: ChapterBlock) => a.order_index - b.order_index))
        })
        .catch(() => { if (!cancelled) setChapterBlocks([]) })
        .finally(() => { if (!cancelled) setLoadingBlocks(false) })
    } else {
      setChapterBlocks([])
    }

    coursesService
      .getChapterAssignments(chapter.id)
      .then((a) => { if (!cancelled) setHasAssignments(a.length > 0) })
      .catch(() => { if (!cancelled) setHasAssignments(false) })

    return () => { cancelled = true }
  }, [chapter])

  const isChapterLocked = useCallback(
    (ch: Chapter, idx: number) => {
      if (!ch.is_locked) return false
      if (idx === 0) return false
      const prev = sortedChapters[idx - 1]
      return !completedIds.has(prev.id)
    },
    [sortedChapters, completedIds],
  )

  const toggleComplete = useCallback(async () => {
    if (!chapter || !courseId || toggling) return

    setToggling(true)
    const wasCompleted = completedIds.has(chapter.id)
    try {
      if (wasCompleted) {
        await coursesService.unmarkChapterComplete(chapter.id)
      } else {
        await coursesService.markChapterComplete(chapter.id)
      }
      const completedChapterIds = await coursesService.getMyChapterProgress(courseId)
      setCompletedIds(new Set(completedChapterIds))
    } catch {
      toast({ title: "Failed to update chapter progress", variant: "destructive" })
    } finally {
      setToggling(false)
    }
  }, [chapter, courseId, completedIds, toggling])

  const refreshCompletion = useCallback(async () => {
    if (!chapter || !courseId) return
    try {
      const completedChapterIds = await coursesService.getMyChapterProgress(courseId)
      setCompletedIds(new Set(completedChapterIds))
    } catch {
      // non-critical
    }
  }, [chapter, courseId])

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  if (error || !mod || !chapter) {
    return (
      <div className="container mx-auto px-4 py-20 text-center">
        <Book className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
        <h2 className="text-lg font-medium mb-2">{error ?? "Chapter not found"}</h2>
        {courseId && moduleId ? (
          <Link to={`/courses/${courseId}/modules/${moduleId}`}>
            <Button variant="outline" size="sm">Back to Module</Button>
          </Link>
        ) : (
          <Link to="/">
            <Button variant="outline" size="sm">Go Home</Button>
          </Link>
        )}
      </div>
    )
  }

  const locked = isChapterLocked(chapter, currentIdx)
  const isCompleted = completedIds.has(chapter.id)

  if (locked) {
    return (
      <div className="container mx-auto px-4 py-6 max-w-3xl">
        <Link to={`/courses/${courseId}/modules/${moduleId}`}>
          <Button variant="ghost" size="sm" className="mb-4 h-8 text-xs">
            <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
            Back to Module
          </Button>
        </Link>

        <div className="text-center py-16">
          <Lock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="font-serif text-xl font-semibold mb-2">Chapter Locked</h2>
          <p className="text-muted-foreground">Complete the previous chapter to unlock this one.</p>
          {prevChapter && (
            <Link to={`/courses/${courseId}/modules/${moduleId}/chapters/${prevChapter.id}`}>
              <Button className="mt-4">Go to Previous Chapter</Button>
            </Link>
          )}
        </div>
      </div>
    )
  }

  const chapterType = chapter.chapter_type || "reading"

  return (
    <div className="container mx-auto px-4 py-6 max-w-3xl">
      {/* Back button */}
      <Link to={`/courses/${courseId}/modules/${moduleId}`}>
        <Button variant="ghost" size="sm" className="mb-6 h-8 text-xs">
          <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
          Back to Module
        </Button>
      </Link>

      {/* Chapter header */}
      <div className="mb-8">
        <div className="mb-3">
          <ChapterTypeBadge type={chapterType} />
        </div>
        <h1 className="text-3xl font-bold font-serif tracking-tight mb-1">{chapter.title}</h1>
        <p className="text-sm text-muted-foreground">
          Chapter {currentIdx + 1} of {sortedChapters.length}
          {mod.title && <> &middot; {mod.title}</>}
        </p>
      </div>

      {/* Content area based on chapter type */}
      <div className="mb-8 space-y-6">
        {(chapterType === "reading" || chapterType === "content") && (
          loadingBlocks ? (
            <div className="flex justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : chapterBlocks.length > 0 ? (
            <div className="space-y-6">
              {chapterBlocks.map((block) => (
                <BlockRenderer key={block.id} block={block} onAssignmentSubmitted={refreshCompletion} />
              ))}
            </div>
          ) : chapter.content ? (
            <div
              className="prose dark:prose-invert max-w-none"
              dangerouslySetInnerHTML={{ __html: sanitize(chapter.content) }}
            />
          ) : null
        )}

        {chapterType === "video" && (
          <>
            {chapter.video_url && (() => {
              const videoId = extractYouTubeId(chapter.video_url!)
              return videoId ? (
                <div className="relative w-full overflow-hidden rounded-xl shadow-sm" style={{ paddingBottom: "56.25%" }}>
                  <iframe
                    className="absolute inset-0 h-full w-full"
                    src={`https://www.youtube.com/embed/${videoId}`}
                    title={chapter.title}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              ) : null
            })()}
            {loadingBlocks ? (
              <div className="flex justify-center py-8">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            ) : chapterBlocks.length > 0 ? (
              <div className="space-y-6">
                {chapterBlocks.map((block) => (
                  <BlockRenderer key={block.id} block={block} onAssignmentSubmitted={refreshCompletion} />
                ))}
              </div>
            ) : chapter.content ? (
              <div
                className="prose dark:prose-invert max-w-none"
                dangerouslySetInnerHTML={{ __html: sanitize(chapter.content) }}
              />
            ) : null}
          </>
        )}

        {chapterType === "audio" && (
          <>
            {chapter.video_url && (
              <div className="rounded-xl border bg-card p-6">
                <div className="flex items-center gap-3 mb-4">
                  <Headphones className="h-5 w-5 text-teal-600" />
                  <span className="font-medium text-sm">Audio Lesson</span>
                </div>
                <audio controls className="w-full" src={chapter.video_url}>
                  Your browser does not support the audio element.
                </audio>
              </div>
            )}
            {loadingBlocks ? (
              <div className="flex justify-center py-8">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            ) : chapterBlocks.length > 0 ? (
              <div className="space-y-6">
                {chapterBlocks.map((block) => (
                  <BlockRenderer key={block.id} block={block} onAssignmentSubmitted={refreshCompletion} />
                ))}
              </div>
            ) : chapter.content ? (
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Transcript</h3>
                <div
                  className="prose dark:prose-invert max-w-none"
                  dangerouslySetInnerHTML={{ __html: sanitize(chapter.content) }}
                />
              </div>
            ) : null}
          </>
        )}

        {(chapterType === "quiz" || chapterType === "exam") && (
          <QuizTaker chapterId={chapter.id} />
        )}

        {chapterType === "assignment" && (
          <AssignmentPanel chapterId={chapter.id} onSubmitted={refreshCompletion} />
        )}

        {chapterType === "discussion" && (
          <div className="space-y-4">
            {chapter.content && (
              <div className="rounded-xl border bg-card p-6">
                <div className="flex items-center gap-2 mb-3">
                  <MessageSquare className="h-5 w-5 text-cyan-600" />
                  <span className="font-medium text-sm">Discussion Prompt</span>
                </div>
                <div
                  className="prose dark:prose-invert max-w-none"
                  dangerouslySetInnerHTML={{ __html: sanitize(chapter.content) }}
                />
              </div>
            )}
            {loadingBlocks ? (
              <div className="flex justify-center py-8">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            ) : chapterBlocks.length > 0 ? (
              <div className="space-y-6">
                {chapterBlocks.map((block) => (
                  <BlockRenderer key={block.id} block={block} onAssignmentSubmitted={refreshCompletion} />
                ))}
              </div>
            ) : null}
            <div>
              <label htmlFor="discussion-response" className="text-sm font-medium mb-2 block">
                Your Response
              </label>
              <textarea
                id="discussion-response"
                value={discussionResponse}
                onChange={(e) => setDiscussionResponse(e.target.value)}
                placeholder="Share your thoughts on this topic..."
                className="w-full min-h-[160px] p-4 text-sm bg-muted/30 border rounded-lg resize-y focus:outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground/50"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Discussion responses are for personal reflection and are not saved.
              </p>
            </div>
          </div>
        )}

        {chapterType === "mixed" && (
          <>
            {loadingBlocks ? (
              <div className="flex justify-center py-8">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            ) : chapterBlocks.length > 0 ? (
              <div className="space-y-6">
                {chapterBlocks.map((block) => (
                  <BlockRenderer key={block.id} block={block} onAssignmentSubmitted={refreshCompletion} />
                ))}
              </div>
            ) : (
              <>
                {chapter.video_url && (() => {
                  const videoId = extractYouTubeId(chapter.video_url!)
                  return videoId ? (
                    <div className="relative w-full overflow-hidden rounded-xl shadow-sm" style={{ paddingBottom: "56.25%" }}>
                      <iframe
                        className="absolute inset-0 h-full w-full"
                        src={`https://www.youtube.com/embed/${videoId}`}
                        title={chapter.title}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    </div>
                  ) : null
                })()}
                {chapter.content && (
                  <div
                    className="prose dark:prose-invert max-w-none"
                    dangerouslySetInnerHTML={{ __html: sanitize(chapter.content) }}
                  />
                )}
                <QuizTaker chapterId={chapter.id} />
                <AssignmentPanel chapterId={chapter.id} onSubmitted={refreshCompletion} />
              </>
            )}
          </>
        )}

        {/* Fallback for unrecognised types that have content */}
        {!["reading", "content", "video", "audio", "quiz", "exam", "assignment", "discussion", "mixed"].includes(chapterType) && chapter.content && (
          <div
            className="prose dark:prose-invert max-w-none"
            dangerouslySetInnerHTML={{ __html: sanitize(chapter.content) }}
          />
        )}
      </div>

      {/* Student Notes */}
      <StudentNotes chapterId={chapter.id} />

      {/* Completion toggle */}
      <div className="mt-6 pt-4 border-t">
        {hasAssignments ? (
          isCompleted ? (
            <p className="text-sm text-green-600 dark:text-green-400 flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              Completed
            </p>
          ) : (
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <Circle className="h-4 w-4" />
              Submit the assignment to complete this chapter
            </p>
          )
        ) : (
          <button
            type="button"
            onClick={toggleComplete}
            disabled={toggling}
            className="flex items-center gap-2 text-sm transition-colors hover:text-primary disabled:opacity-50"
          >
            {isCompleted ? (
              <>
                <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                <span className="text-green-600 dark:text-green-400 font-medium">Completed — click to undo</span>
              </>
            ) : (
              <>
                <Circle className="h-5 w-5 text-muted-foreground/40" />
                <span>Mark as complete</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* Navigation arrows */}
      <div className="mt-8 pt-6 border-t flex items-center justify-between">
        {prevChapter ? (
          <Button
            variant="outline"
            onClick={() => navigate(`/courses/${courseId}/modules/${moduleId}/chapters/${prevChapter.id}`)}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Previous Chapter
          </Button>
        ) : (
          <Button variant="outline" disabled className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Previous Chapter
          </Button>
        )}

        <span className="text-xs text-muted-foreground hidden sm:block">
          {currentIdx + 1} / {sortedChapters.length}
        </span>

        {nextChapter ? (
          isChapterLocked(nextChapter, currentIdx + 1) ? (
            <Button variant="outline" disabled className="gap-2">
              <Lock className="h-4 w-4" />
              Next Chapter
            </Button>
          ) : (
            <Button
              variant="outline"
              onClick={() => navigate(`/courses/${courseId}/modules/${moduleId}/chapters/${nextChapter.id}`)}
              className="gap-2"
            >
              Next Chapter
              <ArrowRight className="h-4 w-4" />
            </Button>
          )
        ) : (
          <Button variant="outline" disabled className="gap-2">
            Next Chapter
            <ArrowRight className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  )
}
