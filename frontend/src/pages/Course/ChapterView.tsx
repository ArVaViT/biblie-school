import { useEffect, useState, useCallback, useMemo, memo, type ReactNode } from "react"
import { useParams, Link, useNavigate } from "react-router-dom"
import { sanitizeHtml as sanitize } from "@/lib/sanitize"
import PageSpinner from "@/components/ui/PageSpinner"
import { Button } from "@/components/ui/button"
import { coursesService } from "@/services/courses"
import { useAuth } from "@/context/useAuth"
import type { Module, Chapter, ChapterBlock } from "@/types"
import {
  ArrowLeft,
  ArrowRight,
  Book,
  CheckCircle,
  Circle,
  Lock,
  Download,
  File,
} from "lucide-react"
import QuizTaker from "@/components/quiz/QuizTaker"
import AssignmentPanel from "@/components/assignment/AssignmentPanel"
import {
  isGradableChapterType,
  normalizeChapterType,
} from "@/lib/chapterTypes"
import ChapterTypeBadge from "@/components/course/ChapterTypeBadge"

const BlockRenderer = memo(function BlockRenderer({
  block,
  onProgressChanged,
  onAssignmentCountLoaded,
}: {
  block: ChapterBlock
  onProgressChanged?: () => void
  onAssignmentCountLoaded?: (count: number) => void
}) {
  const sanitizedContent = useMemo(
    () => (block.content ? sanitize(block.content) : ""),
    [block.content],
  )

  switch (block.block_type) {
    case "text":
      return sanitizedContent ? (
        <div
          className="prose max-w-none"
          dangerouslySetInnerHTML={{ __html: sanitizedContent }}
        />
      ) : null

    case "quiz":
      return block.quiz_id ? (
        <QuizTaker chapterId={block.chapter_id} quizId={block.quiz_id} onSubmitted={onProgressChanged} />
      ) : null

    case "assignment":
      return block.assignment_id ? (
        <AssignmentPanel
          chapterId={block.chapter_id}
          assignmentId={block.assignment_id}
          onSubmitted={onProgressChanged}
          onCountLoaded={onAssignmentCountLoaded}
        />
      ) : null

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
})

/**
 * Renders the shared "show custom blocks if the chapter has them, otherwise
 * fall back to a static per-type view" pattern. Every content-carrying chapter
 * type (reading, video, audio, mixed) needs this exact handling,
 * so centralising it cuts out ~60 lines of duplication.
 */
function ChapterBodyBlocks({
  loading,
  blocks,
  fallback,
  onProgressChanged,
  onAssignmentCountLoaded,
}: {
  loading: boolean
  blocks: ChapterBlock[]
  fallback: ReactNode
  onProgressChanged?: () => void
  onAssignmentCountLoaded?: (count: number) => void
}) {
  if (loading) return <PageSpinner variant="section" />
  if (blocks.length > 0) {
    return (
      <div className="space-y-6">
        {blocks.map((block) => (
          <BlockRenderer
            key={block.id}
            block={block}
            onProgressChanged={onProgressChanged}
            onAssignmentCountLoaded={onAssignmentCountLoaded}
          />
        ))}
      </div>
    )
  }
  return <>{fallback}</>
}

function ChapterNav({
  prevChapter,
  nextChapter,
  currentIdx,
  total,
  courseId,
  moduleId,
  isNextLocked,
}: {
  prevChapter: Chapter | null
  nextChapter: Chapter | null
  currentIdx: number
  total: number
  courseId?: string
  moduleId?: string
  isNextLocked: boolean
}) {
  const navigate = useNavigate()

  return (
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

      <span className="text-xs text-muted-foreground">
        {currentIdx + 1}/{total}
      </span>

      {nextChapter ? (
        isNextLocked ? (
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
  )
}

export default function ChapterView() {
  const { courseId, moduleId, chapterId } = useParams<{
    courseId: string
    moduleId: string
    chapterId: string
  }>()
  const { user } = useAuth()

  const [mod, setMod] = useState<Module | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set())
  const [chapterBlocks, setChapterBlocks] = useState<ChapterBlock[]>([])
  const [loadingBlocks, setLoadingBlocks] = useState(false)
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
        const [m, completedChapterIds] = await Promise.all([
          coursesService.getModule(courseId, moduleId),
          coursesService.getMyChapterProgress(courseId).catch(() => [] as string[]),
        ])
        if (cancelled) return
        setMod(m)
        setCompletedIds(new Set(completedChapterIds))
      } catch {
        if (!cancelled) setError("Failed to load chapter. Please try again.")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [courseId, moduleId, user?.id])

  const sortedChapters = useMemo(
    () => [...(mod?.chapters ?? [])].sort((a, b) => a.order_index - b.order_index),
    [mod],
  )

  const currentIdx = sortedChapters.findIndex((c) => c.id === chapterId)
  const chapter = currentIdx >= 0 ? sortedChapters[currentIdx] : null
  const prevChapter = currentIdx > 0 ? sortedChapters[currentIdx - 1] ?? null : null
  const nextChapter = currentIdx < sortedChapters.length - 1 ? sortedChapters[currentIdx + 1] ?? null : null

  useEffect(() => {
    if (!chapter) return
    let cancelled = false

    setHasAssignments(false)

    // Only reading chapters carry blocks; quiz/exam/assignment render their
    // own dedicated panels.
    if (normalizeChapterType(chapter.chapter_type) !== "reading") {
      setChapterBlocks([])
      return
    }

    setLoadingBlocks(true)
    coursesService
      .getChapterBlocks(chapter.id)
      .catch(() => [] as ChapterBlock[])
      .then((blocks) => {
        if (cancelled) return
        setChapterBlocks(blocks.sort((a, b) => a.order_index - b.order_index))
        setLoadingBlocks(false)
      })

    return () => { cancelled = true }
  }, [chapter])

  const isChapterLocked = useCallback(
    (ch: Chapter, idx: number) => {
      if (!ch.is_locked) return false
      if (idx === 0) return false
      const prev = sortedChapters[idx - 1]
      if (!prev || !isGradableChapterType(prev.chapter_type)) return false
      return !completedIds.has(prev.id)
    },
    [sortedChapters, completedIds],
  )

  const refreshCompletion = useCallback(async () => {
    if (!chapter || !courseId) return
    try {
      const completedChapterIds = await coursesService.getMyChapterProgress(courseId)
      setCompletedIds(new Set(completedChapterIds))
    } catch {
      // non-critical
    }
  }, [chapter, courseId])

  const handleAssignmentCountLoaded = useCallback((count: number) => {
    setHasAssignments((prev) => (count > 0 ? true : prev))
  }, [])

  const sanitizedChapterContent = useMemo(
    () => (chapter?.content ? sanitize(chapter.content) : ""),
    [chapter?.content],
  )

  if (loading) {
    return <PageSpinner />
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

  const chapterType = normalizeChapterType(chapter.chapter_type)

  const proseFallback = sanitizedChapterContent ? (
    <div
      className="prose max-w-none"
      dangerouslySetInnerHTML={{ __html: sanitizedChapterContent }}
    />
  ) : null

  return (
    <div className="container mx-auto px-4 py-6 max-w-3xl">
      <Link to={`/courses/${courseId}/modules/${moduleId}`}>
        <Button variant="ghost" size="sm" className="mb-6 h-8 text-xs">
          <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
          Back to Module
        </Button>
      </Link>

      <div className="mb-8">
        <div className="mb-3">
          <ChapterTypeBadge type={chapterType} />
        </div>
        <h1 className="mb-1 font-serif text-3xl font-bold tracking-tight text-wrap-safe">
          {chapter.title}
        </h1>
        <p className="text-sm text-muted-foreground text-wrap-safe">
          Chapter {currentIdx + 1} of {sortedChapters.length}
          {mod.title && <> &middot; {mod.title}</>}
        </p>
      </div>

      <div className="mb-8 space-y-6">
        {chapterType === "reading" && (
          <ChapterBodyBlocks
            loading={loadingBlocks}
            blocks={chapterBlocks}
            onProgressChanged={refreshCompletion}
            onAssignmentCountLoaded={handleAssignmentCountLoaded}
            fallback={
              proseFallback ?? (
                <p className="text-muted-foreground text-center py-8">
                  No content has been added to this chapter yet.
                </p>
              )
            }
          />
        )}

        {(chapterType === "quiz" || chapterType === "exam") && (
          <QuizTaker chapterId={chapter.id} onSubmitted={refreshCompletion} />
        )}

        {chapterType === "assignment" && (
          <AssignmentPanel
            chapterId={chapter.id}
            onSubmitted={refreshCompletion}
            onCountLoaded={handleAssignmentCountLoaded}
          />
        )}
      </div>

      {hasAssignments && (
        <div className="mt-6 pt-4 border-t">
          {isCompleted ? (
            <p className="flex items-center gap-2 text-sm text-success">
              <CheckCircle className="h-4 w-4" />
              Completed
            </p>
          ) : (
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <Circle className="h-4 w-4" />
              Submit the assignment to complete this chapter
            </p>
          )}
        </div>
      )}

      <ChapterNav
        prevChapter={prevChapter}
        nextChapter={nextChapter}
        currentIdx={currentIdx}
        total={sortedChapters.length}
        courseId={courseId}
        moduleId={moduleId}
        isNextLocked={nextChapter ? isChapterLocked(nextChapter, currentIdx + 1) : false}
      />
    </div>
  )
}
