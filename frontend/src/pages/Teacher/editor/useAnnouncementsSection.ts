import { useCallback, useEffect, useState } from "react"
import { coursesService } from "@/services/courses"
import { toast } from "@/lib/toast"
import type { Announcement } from "@/types"
import type { useConfirm } from "@/components/ui/alert-dialog"

type Confirm = ReturnType<typeof useConfirm>

interface AnnouncementsSection {
  announcements: Announcement[]
  title: string
  setTitle: (v: string) => void
  content: string
  setContent: (v: string) => void
  posting: boolean
  post: () => Promise<void>
  remove: (id: string) => Promise<void>
  resetForm: () => void
}

/**
 * Owns the "Announcements" modal state for a course: the list, the
 * inline create-form, and the post/delete handlers.
 */
export function useAnnouncementsSection(
  courseId: string | undefined,
  confirm: Confirm,
): AnnouncementsSection {
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [title, setTitle] = useState("")
  const [content, setContent] = useState("")
  const [posting, setPosting] = useState(false)

  useEffect(() => {
    if (!courseId) return
    let cancelled = false
    coursesService
      .getAnnouncements(courseId)
      .then((a) => {
        if (!cancelled) setAnnouncements(a)
      })
      .catch(() => {
        if (!cancelled) setAnnouncements([])
      })
    return () => {
      cancelled = true
    }
  }, [courseId])

  const resetForm = useCallback(() => {
    setTitle("")
    setContent("")
  }, [])

  const post = useCallback(async () => {
    if (!courseId || !title.trim()) return
    setPosting(true)
    try {
      const a = await coursesService.createAnnouncement({
        title: title.trim(),
        content: content.trim(),
        course_id: courseId,
      })
      setAnnouncements((p) => [a, ...p])
      resetForm()
    } catch {
      toast({ title: "Failed", variant: "destructive" })
    } finally {
      setPosting(false)
    }
  }, [courseId, title, content, resetForm])

  const remove = useCallback(
    async (id: string) => {
      const ok = await confirm({
        title: "Delete this announcement?",
        confirmLabel: "Delete",
        tone: "destructive",
      })
      if (!ok) return
      try {
        await coursesService.deleteAnnouncement(id)
        setAnnouncements((p) => p.filter((a) => a.id !== id))
      } catch {
        toast({ title: "Failed", variant: "destructive" })
      }
    },
    [confirm],
  )

  return {
    announcements,
    title,
    setTitle,
    content,
    setContent,
    posting,
    post,
    remove,
    resetForm,
  }
}
