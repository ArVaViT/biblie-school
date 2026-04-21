import { useState, useEffect, useRef, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { AlertCircle, Bell, CheckCheck, Award, XCircle, ClipboardCheck, Megaphone, BookOpen, UserCheck, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { coursesService } from "@/services/courses"
import type { Notification, NotificationType } from "@/types"
import { cn } from "@/lib/utils"
import PageSpinner from "@/components/ui/PageSpinner"

const NOTIFICATION_ICONS: Record<NotificationType, typeof Bell> = {
  certificate_approved: Award,
  certificate_rejected: XCircle,
  assignment_graded: ClipboardCheck,
  new_announcement: Megaphone,
  course_update: BookOpen,
  enrollment_confirmed: UserCheck,
}

const NOTIFICATION_COLORS: Record<NotificationType, string> = {
  certificate_approved: "text-emerald-500",
  certificate_rejected: "text-red-500",
  assignment_graded: "text-blue-500",
  new_announcement: "text-amber-500",
  course_update: "text-purple-500",
  enrollment_confirmed: "text-teal-500",
}

function timeAgo(dateStr: string): string {
  const parsed = new Date(dateStr).getTime()
  if (Number.isNaN(parsed)) return "—"
  const now = Date.now()
  const diff = now - parsed
  const seconds = Math.floor(diff / 1000)
  if (seconds < 60) return "just now"
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString()
}

export default function NotificationBell() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  const fetchUnreadCount = useCallback(async (signal?: { cancelled: boolean }) => {
    try {
      const count = await coursesService.getUnreadCount()
      if (!signal?.cancelled) setUnreadCount(count)
    } catch {
      // Polling failure is non-critical; will retry on next interval
    }
  }, [])

  const fetchNotifications = useCallback(async (pageNum: number, signal?: { cancelled: boolean }) => {
    if (pageNum === 1) {
      setLoading(true)
      setLoadError(false)
    } else {
      setLoadingMore(true)
    }
    try {
      const res = await coursesService.getNotifications(pageNum)
      if (!signal?.cancelled) {
        if (pageNum === 1) {
          setNotifications(res.items)
        } else {
          setNotifications(prev => [...prev, ...res.items])
        }
        setPage(pageNum)
        setHasMore(pageNum * res.page_size < res.total)
      }
    } catch {
      // On the first page treat this as an error state so the user isn't
      // silently shown the empty "No notifications yet" placeholder; on
      // subsequent pages leave the already-rendered list alone.
      if (!signal?.cancelled && pageNum === 1) setLoadError(true)
    } finally {
      if (!signal?.cancelled) {
        if (pageNum === 1) setLoading(false)
        else setLoadingMore(false)
      }
    }
  }, [])

  useEffect(() => {
    const signal = { cancelled: false }
    fetchUnreadCount(signal)
    const interval = setInterval(() => fetchUnreadCount(signal), 30_000)
    return () => { signal.cancelled = true; clearInterval(interval) }
  }, [fetchUnreadCount])

  const loadMoreSignalRef = useRef<{ cancelled: boolean } | null>(null)

  useEffect(() => {
    if (!open) {
      setNotifications([])
      setPage(1)
      setHasMore(false)
      setLoadingMore(false)
      setLoadError(false)
      if (loadMoreSignalRef.current) loadMoreSignalRef.current.cancelled = true
      return
    }
    const signal = { cancelled: false }
    fetchNotifications(1, signal)
    return () => {
      signal.cancelled = true
      if (loadMoreSignalRef.current) loadMoreSignalRef.current.cancelled = true
    }
  }, [open, fetchNotifications])

  const handleLoadMore = useCallback(() => {
    if (loadMoreSignalRef.current) loadMoreSignalRef.current.cancelled = true
    const signal = { cancelled: false }
    loadMoreSignalRef.current = signal
    void fetchNotifications(page + 1, signal)
  }, [fetchNotifications, page])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        panelRef.current && !panelRef.current.contains(e.target as Node) &&
        buttonRef.current && !buttonRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [open])

  const handleNotificationClick = async (n: Notification) => {
    if (!n.is_read) {
      try {
        await coursesService.markAsRead(n.id)
        setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, is_read: true } : x))
        setUnreadCount(prev => Math.max(0, prev - 1))
      } catch {
        // Optimistic UI: still navigate even if mark-read fails
      }
    }
    setOpen(false)
    if (n.link && n.link.startsWith("/")) navigate(n.link)
  }

  const handleMarkAllRead = async () => {
    try {
      await coursesService.markAllAsRead()
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
      setUnreadCount(0)
    } catch {
      // Mark-all best effort; badge will correct on next poll
    }
  }

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    try {
      await coursesService.deleteNotification(id)
      const removed = notifications.find(n => n.id === id)
      setNotifications(prev => prev.filter(n => n.id !== id))
      if (removed && !removed.is_read) setUnreadCount(prev => Math.max(0, prev - 1))
    } catch {
      // Delete failed; notification remains in the list
    }
  }

  return (
    <div className="relative">
      <Button
        ref={buttonRef}
        variant="ghost"
        size="sm"
        className="h-8 w-8 p-0 relative"
        onClick={() => setOpen(prev => !prev)}
        aria-label="Notifications"
        aria-expanded={open}
        aria-haspopup="true"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </Button>

      {open && (
        <div
          ref={panelRef}
          role="region"
          aria-label="Notifications"
          className="absolute right-0 top-full mt-2 w-80 sm:w-96 rounded-lg border border-border bg-background shadow-lg z-50 overflow-hidden"
        >
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h3 className="text-sm font-semibold text-foreground">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-[400px] overflow-y-auto">
            {loading ? (
              <PageSpinner variant="section" />
            ) : loadError ? (
              <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
                <AlertCircle className="h-8 w-8 text-destructive/70" />
                <p className="text-sm text-destructive">Failed to load notifications.</p>
                <button
                  onClick={() => fetchNotifications(1)}
                  className="text-xs text-primary hover:underline"
                >
                  Try again
                </button>
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
                <Bell className="h-8 w-8 opacity-30" />
                <p className="text-sm">No notifications yet</p>
              </div>
            ) : (
              <>
                {notifications.map(n => {
                  const Icon = NOTIFICATION_ICONS[n.type] ?? Bell
                  const color = NOTIFICATION_COLORS[n.type] ?? "text-muted-foreground"
                  return (
                    <div
                      key={n.id}
                      className={cn(
                        "flex gap-3 px-4 py-3 transition-colors hover:bg-muted/50 group border-b border-border/50 last:border-0",
                        !n.is_read && "bg-primary/[0.03]",
                      )}
                    >
                      <button
                        onClick={() => handleNotificationClick(n)}
                        className="flex gap-3 flex-1 min-w-0 text-left cursor-pointer bg-transparent border-0 p-0"
                        aria-label={n.title}
                      >
                        <div className={cn("mt-0.5 shrink-0", color)}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <p className={cn("text-sm leading-snug", !n.is_read ? "font-medium text-foreground" : "text-muted-foreground")}>
                              {n.title}
                            </p>
                            {!n.is_read && (
                              <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                            )}
                          </div>
                          <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{n.message}</p>
                          <p className="mt-1 text-[11px] text-muted-foreground/70">{timeAgo(n.created_at)}</p>
                        </div>
                      </button>
                      <button
                        onClick={(e) => handleDelete(e, n.id)}
                        className="mt-0.5 shrink-0 opacity-60 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                        aria-label="Delete notification"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )
                })}
                {hasMore && (
                  <div className="border-t border-border/50 p-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="w-full text-xs"
                      disabled={loadingMore}
                      onClick={handleLoadMore}
                    >
                      {loadingMore ? "Loading..." : "Load more"}
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
