import { forwardRef } from "react"
import { AlertCircle, Bell, CheckCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import PageSpinner from "@/components/ui/PageSpinner"
import type { Notification } from "@/types"
import { NotificationItem } from "./NotificationItem"

interface Props {
  notifications: Notification[]
  unreadCount: number
  loading: boolean
  loadingMore: boolean
  loadError: boolean
  hasMore: boolean
  onActivate: (n: Notification) => void
  onDelete: (id: string) => void
  onMarkAllRead: () => void
  onLoadMore: () => void
  onRetry: () => void
}

/**
 * Drop-down panel anchored below the bell. Purely presentational — all
 * state lives in `useNotifications` and is handed in via props.
 */
export const NotificationPanel = forwardRef<HTMLDivElement, Props>(
  function NotificationPanel(
    {
      notifications,
      unreadCount,
      loading,
      loadingMore,
      loadError,
      hasMore,
      onActivate,
      onDelete,
      onMarkAllRead,
      onLoadMore,
      onRetry,
    },
    ref,
  ) {
    return (
      <div
        ref={ref}
        role="region"
        aria-label="Notifications"
        className="absolute right-0 top-full mt-2 w-80 sm:w-96 rounded-lg border border-border bg-background shadow-lg z-50 overflow-hidden"
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h3 className="text-sm font-semibold text-foreground">Notifications</h3>
          {unreadCount > 0 && (
            <button
              onClick={onMarkAllRead}
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
                onClick={onRetry}
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
              {notifications.map((n) => (
                <NotificationItem
                  key={n.id}
                  notification={n}
                  onActivate={onActivate}
                  onDelete={onDelete}
                />
              ))}
              {hasMore && (
                <div className="border-t border-border/50 p-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="w-full text-xs"
                    disabled={loadingMore}
                    onClick={onLoadMore}
                  >
                    {loadingMore ? "Loading..." : "Load more"}
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    )
  },
)
