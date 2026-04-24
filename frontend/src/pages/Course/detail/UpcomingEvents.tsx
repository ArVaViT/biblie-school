import { AlertTriangle, CalendarDays } from "lucide-react"
import type { CalendarEvent } from "@/types"

interface Props {
  events: CalendarEvent[]
}

export function UpcomingEvents({ events }: Props) {
  if (events.length === 0) return null

  const now = new Date()
  const upcoming = events
    .filter((e) => {
      if (!e.event_date) return false
      const t = new Date(e.event_date).getTime()
      return !Number.isNaN(t) && t > now.getTime() - 24 * 60 * 60 * 1000
    })
    .slice(0, 5)

  if (upcoming.length === 0) return null

  return (
    <div className="mb-5">
      <h2 className="text-sm font-semibold mb-2 flex items-center gap-2 text-muted-foreground">
        <CalendarDays className="h-3.5 w-3.5" />
        Upcoming Deadlines & Events
      </h2>
      <div className="space-y-1.5">
        {upcoming.map((evt) => {
          const evtDate = new Date(evt.event_date)
          const overdue = evtDate < now && evt.event_type === "deadline"
          return (
            <div
              key={evt.id}
              className={`flex items-center gap-2 px-3 py-2 rounded-md border text-sm ${
                overdue
                  ? "border-l-[3px] border-l-destructive border-border bg-destructive/5"
                  : "border-border hover:bg-muted/50"
              }`}
            >
              {overdue ? (
                <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />
              ) : (
                <span
                  className={`h-2 w-2 shrink-0 rounded-full ${
                    evt.event_type === "deadline"
                      ? "bg-destructive"
                      : evt.event_type === "live_session"
                        ? "bg-info"
                        : evt.event_type === "exam"
                          ? "bg-warning"
                          : "bg-muted-foreground/50"
                  }`}
                />
              )}
              <span className={`flex-1 truncate ${overdue ? "text-destructive" : ""}`}>
                {evt.title}
              </span>
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {evtDate.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
