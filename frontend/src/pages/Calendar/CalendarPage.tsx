import { CalendarDays, Filter, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import PageSpinner from "@/components/ui/PageSpinner";
import { ErrorState } from "@/components/patterns";

import { MonthGrid } from "./MonthGrid";
import { SelectedDayPanel } from "./SelectedDayPanel";
import { UpcomingEventsPanel } from "./UpcomingEventsPanel";
import { useCalendarData } from "./useCalendarData";
import { useMonthGrid } from "./useMonthGrid";

export default function CalendarPage() {
  const {
    events,
    enrollments,
    loading,
    fetchError,
    retry,
    filterCourseId,
    setFilterCourseId,
  } = useCalendarData();

  const {
    year,
    month,
    calendarDays,
    eventsByDate,
    selectedDay,
    setSelectedDay,
    selectedDayEvents,
    upcomingEvents,
    prevMonth,
    nextMonth,
    goToday,
  } = useMonthGrid(events);

  if (loading) {
    return <PageSpinner />;
  }

  if (fetchError) {
    return (
      <div className="container mx-auto px-4">
        <ErrorState
          description={fetchError}
          action={
            <Button variant="outline" size="sm" onClick={retry}>
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              Retry
            </Button>
          }
        />
      </div>
    );
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
              aria-label="Filter by course"
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
        <div className="lg:col-span-2">
          <MonthGrid
            year={year}
            month={month}
            today={new Date()}
            calendarDays={calendarDays}
            eventsByDate={eventsByDate}
            selectedDay={selectedDay}
            onSelectDay={setSelectedDay}
            onPrevMonth={prevMonth}
            onNextMonth={nextMonth}
            onGoToday={goToday}
          />
        </div>

        <div className="space-y-4">
          {selectedDay && (
            <SelectedDayPanel selectedDay={selectedDay} events={selectedDayEvents} />
          )}
          <UpcomingEventsPanel events={upcomingEvents} />
        </div>
      </div>
    </div>
  );
}
