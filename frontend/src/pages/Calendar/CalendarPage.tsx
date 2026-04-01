import { useEffect, useState, useMemo } from "react"
import { Link } from "react-router-dom"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { coursesService } from "@/services/courses"
import type { CalendarEvent, Enrollment } from "@/types"
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Clock,
  BookOpen,
  Filter,
  AlertTriangle,
  RefreshCw,
} from "lucide-react"

const EVENT_COLORS: Record<string, { dot: string; bg: string; text: string; border: string }> = {
  deadline: {
    dot: "bg-red-500",
    bg: "bg-red-50 dark:bg-red-950/30",
    text: "text-red-700 dark:text-red-400",
    border: "border-red-200 dark:border-red-800",
  },
  live_session: {
    dot: "bg-blue-500",
    bg: "bg-blue-50 dark:bg-blue-950/30",
    text: "text-blue-700 dark:text-blue-400",
    border: "border-blue-200 dark:border-blue-800",
  },
  exam: {
    dot: "bg-orange-500",
    bg: "bg-orange-50 dark:bg-orange-950/30",
    text: "text-orange-700 dark:text-orange-400",
    border: "border-orange-200 dark:border-orange-800",
  },
  other: {
    dot: "bg-gray-400",
    bg: "bg-gray-50 dark:bg-gray-900/30",
    text: "text-gray-700 dark:text-gray-400",
    border: "border-gray-200 dark:border-gray-700",
  },
}

function getEventColor(type: string) {
  return EVENT_COLORS[type] ?? EVENT_COLORS.other
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
}

function formatShortDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

function isOverdue(dateStr: string) {
  return new Date(dateStr) < new Date()
}

export default function CalendarPage() {
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [enrollments, setEnrollments] = useState<Enrollment[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const [currentDate, setCurrentDate] = useState(() => new Date())
  const [selectedDay, setSelectedDay] = useState<Date | null>(() => new Date())
  const [filterCourseId, setFilterCourseId] = useState<string>("")

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setFetchError(null)
    const load = async () => {
      try {
        const [evts, enrolls] = await Promise.all([
          coursesService.getCalendarEvents(filterCourseId || undefined),
          coursesService.getMyCourses().catch(() => []),
        ])
        if (cancelled) return
        setEvents(evts)
        setEnrollments(enrolls)
      } catch {
        if (!cancelled) setFetchError("Failed to load calendar events. Please try again.")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [filterCourseId, retryCount])

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()

  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const startOffset = firstDay.getDay()
    const days: Array<{ date: Date; inMonth: boolean }> = []

    for (let i = startOffset - 1; i >= 0; i--) {
      const d = new Date(year, month, -i)
      days.push({ date: d, inMonth: false })
    }
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push({ date: new Date(year, month, i), inMonth: true })
    }
    const remaining = 7 - (days.length % 7)
    if (remaining < 7) {
      for (let i = 1; i <= remaining; i++) {
        days.push({ date: new Date(year, month + 1, i), inMonth: false })
      }
    }
    return days
  }, [year, month])

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>()
    for (const evt of events) {
      const d = new Date(evt.event_date)
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(evt)
    }
    return map
  }, [events])

  const selectedDayEvents = useMemo(() => {
    if (!selectedDay) return []
    const key = `${selectedDay.getFullYear()}-${selectedDay.getMonth()}-${selectedDay.getDate()}`
    return eventsByDate.get(key) ?? []
  }, [selectedDay, eventsByDate])

  const upcomingEvents = useMemo(() => {
    const now = new Date()
    const twoWeeks = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)
    return events.filter((e) => {
      const d = new Date(e.event_date)
      return d >= now && d <= twoWeeks
    })
  }, [events])

  const today = new Date()

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1))
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1))
  const goToday = () => setCurrentDate(new Date())

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  if (fetchError) {
    return (
      <div className="container mx-auto px-4 py-20 text-center">
        <AlertTriangle className="h-12 w-12 text-destructive/60 mx-auto mb-4" />
        <h2 className="text-lg font-medium mb-2">Something went wrong</h2>
        <p className="text-sm text-muted-foreground mb-4">{fetchError}</p>
        <Button variant="outline" size="sm" onClick={() => setRetryCount((c) => c + 1)}>
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
          Retry
        </Button>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-6xl">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="font-serif text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
            <CalendarDays className="h-6 w-6 text-primary" />
            Calendar
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Your deadlines, events, and schedule in one place
          </p>
        </div>

        {enrollments.length > 0 && (
          <div className="flex items-center gap-2">
            <Filter className="h-3.5 w-3.5 text-muted-foreground" />
            <select
              value={filterCourseId}
              onChange={(e) => setFilterCourseId(e.target.value)}
              className="text-sm border rounded-md px-2 py-1.5 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">All Courses</option>
              {enrollments.map((e) => (
                <option key={e.course_id} value={e.course_id}>
                  {e.course?.title ?? e.course_id}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar Grid */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="font-serif text-lg">
                  {MONTH_NAMES[month]} {year}
                </CardTitle>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={prevMonth}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm" className="h-8 text-xs" onClick={goToday}>
                    Today
                  </Button>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={nextMonth}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-2">
              {/* Day headers */}
              <div className="grid grid-cols-7 mb-1">
                {DAY_NAMES.map((d) => (
                  <div key={d} className="text-center text-[10px] font-medium text-muted-foreground uppercase tracking-wider py-1">
                    {d}
                  </div>
                ))}
              </div>

              {/* Day cells */}
              <div className="grid grid-cols-7 border-t border-l">
                {calendarDays.map(({ date, inMonth }, idx) => {
                  const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
                  const dayEvents = eventsByDate.get(key) ?? []
                  const isToday = isSameDay(date, today)
                  const isSelected = selectedDay && isSameDay(date, selectedDay)

                  return (
                    <button
                      key={idx}
                      onClick={() => setSelectedDay(date)}
                      className={`
                        relative min-h-[72px] sm:min-h-[80px] p-1 border-r border-b text-left transition-colors
                        ${inMonth ? "bg-background" : "bg-muted/30"}
                        ${isSelected ? "ring-2 ring-primary ring-inset" : "hover:bg-muted/50"}
                      `}
                    >
                      <span
                        className={`
                          inline-flex items-center justify-center w-6 h-6 text-xs font-medium rounded-full
                          ${isToday ? "bg-primary text-primary-foreground" : ""}
                          ${!inMonth ? "text-muted-foreground/40" : ""}
                        `}
                      >
                        {date.getDate()}
                      </span>

                      {dayEvents.length > 0 && (
                        <div className="flex flex-wrap gap-0.5 mt-0.5">
                          {dayEvents.slice(0, 3).map((evt) => {
                            const color = getEventColor(evt.event_type)
                            return (
                              <span
                                key={evt.id}
                                className={`block w-full rounded px-1 py-0.5 text-[9px] leading-tight truncate ${color.bg} ${color.text}`}
                                title={evt.title}
                              >
                                {evt.title}
                              </span>
                            )
                          })}
                          {dayEvents.length > 3 && (
                            <span className="text-[9px] text-muted-foreground pl-1">
                              +{dayEvents.length - 3} more
                            </span>
                          )}
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>

              {/* Legend */}
              <div className="flex flex-wrap items-center gap-3 mt-3 text-[10px]">
                {Object.entries(EVENT_COLORS).map(([type, color]) => (
                  <span key={type} className="flex items-center gap-1">
                    <span className={`w-2 h-2 rounded-full ${color.dot}`} />
                    <span className="capitalize text-muted-foreground">{type.replace("_", " ")}</span>
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Side Panel */}
        <div className="space-y-4">
          {/* Selected Day Events */}
          {selectedDay && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-primary" />
                  {selectedDay.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {selectedDayEvents.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-3 text-center">No events on this day</p>
                ) : (
                  <div className="space-y-2">
                    {selectedDayEvents.map((evt) => {
                      const color = getEventColor(evt.event_type)
                      return (
                        <div key={evt.id} className={`rounded-lg border p-2.5 ${color.border} ${color.bg}`}>
                          <div className="flex items-start gap-2">
                            <span className={`mt-1 w-2 h-2 rounded-full shrink-0 ${color.dot}`} />
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm font-medium ${color.text}`}>{evt.title}</p>
                              <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground">
                                <span className="flex items-center gap-0.5">
                                  <Clock className="h-2.5 w-2.5" />
                                  {formatTime(evt.event_date)}
                                </span>
                                <span className="capitalize">{evt.event_type.replace("_", " ")}</span>
                              </div>
                              {evt.course_title && (
                                <Link
                                  to={`/courses/${evt.course_id}`}
                                  className="flex items-center gap-1 mt-1 text-[10px] text-primary hover:underline"
                                >
                                  <BookOpen className="h-2.5 w-2.5" />
                                  {evt.course_title}
                                </Link>
                              )}
                              {evt.description && (
                                <p className="text-[10px] text-muted-foreground mt-1 line-clamp-2">{evt.description}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Upcoming 14 days */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                Upcoming (14 days)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {upcomingEvents.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No upcoming events
                </p>
              ) : (
                <div className="space-y-2">
                  {upcomingEvents.map((evt) => {
                    const color = getEventColor(evt.event_type)
                    const overdue = evt.event_type === "deadline" && isOverdue(evt.event_date)
                    return (
                      <div
                        key={evt.id}
                        className={`flex items-start gap-2 p-2 rounded-md border transition-colors ${
                          overdue ? "border-red-300 bg-red-50/50 dark:bg-red-950/20 dark:border-red-800" : "hover:bg-muted/50"
                        }`}
                      >
                        <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${color.dot}`} />
                        <div className="flex-1 min-w-0">
                          <p className={`text-xs font-medium truncate ${overdue ? "text-red-600 dark:text-red-400" : ""}`}>
                            {evt.title}
                          </p>
                          <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                            <span>{formatShortDate(evt.event_date)}</span>
                            <span>{formatTime(evt.event_date)}</span>
                            {overdue && (
                              <span className="text-red-500 font-medium">Overdue</span>
                            )}
                          </div>
                          {evt.course_title && (
                            <p className="text-[10px] text-muted-foreground/70 truncate mt-0.5">
                              {evt.course_title}
                            </p>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
