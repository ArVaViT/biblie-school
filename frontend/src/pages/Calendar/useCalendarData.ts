import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { coursesService } from "@/services/courses";
import type { CalendarEvent, Enrollment } from "@/types";

interface CalendarData {
  events: CalendarEvent[];
  enrollments: Enrollment[];
  loading: boolean;
  fetchError: string | null;
  retry: () => void;
  filterCourseId: string;
  setFilterCourseId: (id: string) => void;
}

/**
 * Owns data loading + URL-bound course filter for the calendar page.
 *
 * The filter is mirrored into `?course=` so a student sharing a link
 * lands on the same filtered view. `retry` bumps a counter to force a
 * reload after a transient fetch failure.
 */
export function useCalendarData(): CalendarData {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [params, setParams] = useSearchParams();

  // Hard cap the query-string value so a crafted URL can't blow up any
  // downstream storage / logging. 64 chars is plenty for a UUID.
  const filterCourseId = (params.get("course") ?? "").slice(0, 64);

  const setFilterCourseId = (id: string) => {
    const next = new URLSearchParams(params);
    if (id) next.set("course", id.slice(0, 64));
    else next.delete("course");
    setParams(next, { replace: true });
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFetchError(null);
    const load = async () => {
      try {
        const [evts, enrolls] = await Promise.all([
          coursesService.getCalendarEvents(filterCourseId || undefined),
          coursesService.getMyCourses().catch(() => []),
        ]);
        if (cancelled) return;
        setEvents(evts);
        setEnrollments(enrolls);
      } catch {
        if (!cancelled) setFetchError("Failed to load calendar events. Please try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [filterCourseId, retryCount]);

  return {
    events,
    enrollments,
    loading,
    fetchError,
    retry: () => setRetryCount((c) => c + 1),
    filterCourseId,
    setFilterCourseId,
  };
}
