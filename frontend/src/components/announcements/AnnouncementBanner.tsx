import { useState, useEffect } from "react"
import { coursesService } from "@/services/courses"
import type { Announcement } from "@/types"
import { Megaphone, X } from "lucide-react"

export default function AnnouncementBanner() {
  const [announcement, setAnnouncement] = useState<Announcement | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    coursesService.getAnnouncements().then((list) => {
      const systemWide = list.find((a) => !a.course_id)
      if (systemWide) setAnnouncement(systemWide)
    }).catch(() => {})
  }, [])

  if (!announcement || dismissed) return null

  return (
    <div className="border-b bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
      <div className="container mx-auto px-4 py-2.5 flex items-center gap-3">
        <Megaphone className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium text-blue-800 dark:text-blue-300">{announcement.title}</span>
          {announcement.content && (
            <span className="text-sm text-blue-700 dark:text-blue-400 ml-2">{announcement.content.slice(0, 150)}</span>
          )}
        </div>
        <button onClick={() => setDismissed(true)} className="p-1 hover:bg-blue-100 dark:hover:bg-blue-900 rounded" aria-label="Dismiss announcement">
          <X className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
        </button>
      </div>
    </div>
  )
}
