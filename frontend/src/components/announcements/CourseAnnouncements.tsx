import { useState, useEffect } from "react"
import { coursesService } from "@/services/courses"
import type { Announcement } from "@/types"
import { Megaphone } from "lucide-react"

interface Props {
  courseId: string
}

export default function CourseAnnouncements({ courseId }: Props) {
  const [announcements, setAnnouncements] = useState<Announcement[]>([])

  useEffect(() => {
    coursesService.getAnnouncements(courseId).then(setAnnouncements).catch(() => {})
  }, [courseId])

  if (announcements.length === 0) return null

  return (
    <div className="space-y-3 mb-6">
      {announcements.map((a) => (
        <div key={a.id} className="flex gap-3 p-4 rounded-lg border bg-blue-50/50 dark:bg-blue-950/20 border-blue-200/50 dark:border-blue-800/50">
          <Megaphone className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
          <div>
            <h4 className="text-sm font-medium">{a.title}</h4>
            <p className="text-xs text-muted-foreground mt-1">{a.content}</p>
            <time className="text-[10px] text-muted-foreground/60 mt-1 block">
              {new Date(a.created_at).toLocaleDateString()}
            </time>
          </div>
        </div>
      ))}
    </div>
  )
}
