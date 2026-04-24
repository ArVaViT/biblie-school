import { useCallback, useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Bell } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { Notification } from "@/types"
import { useNotifications } from "./notifications/useNotifications"
import { NotificationPanel } from "./notifications/NotificationPanel"

/**
 * Header bell: unread badge + on-click dropdown.
 *
 * This component only owns the open/close state and the click-outside
 * behaviour. Everything else (polling, pagination, mutations) lives in
 * `useNotifications`, and the dropdown itself is a pure `NotificationPanel`.
 */
export default function NotificationBell() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  const {
    notifications,
    unreadCount,
    loading,
    loadingMore,
    loadError,
    hasMore,
    loadMore,
    retry,
    markRead,
    markAllRead,
    remove,
  } = useNotifications(open)

  useEffect(() => {
    if (!open) return
    function handleClickOutside(e: MouseEvent) {
      if (
        panelRef.current && !panelRef.current.contains(e.target as Node) &&
        buttonRef.current && !buttonRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [open])

  const handleActivate = useCallback(
    (n: Notification) => {
      if (!n.is_read) void markRead(n.id)
      setOpen(false)
      if (n.link && n.link.startsWith("/")) navigate(n.link)
    },
    [markRead, navigate],
  )

  return (
    <div className="relative">
      <Button
        ref={buttonRef}
        variant="ghost"
        size="sm"
        className="h-8 w-8 p-0 relative"
        onClick={() => setOpen((prev) => !prev)}
        aria-label="Notifications"
        aria-expanded={open}
        aria-haspopup="true"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </Button>

      {open && (
        <NotificationPanel
          ref={panelRef}
          notifications={notifications}
          unreadCount={unreadCount}
          loading={loading}
          loadingMore={loadingMore}
          loadError={loadError}
          hasMore={hasMore}
          onActivate={handleActivate}
          onDelete={(id) => void remove(id)}
          onMarkAllRead={() => void markAllRead()}
          onLoadMore={loadMore}
          onRetry={retry}
        />
      )}
    </div>
  )
}
