"use client";

import { useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { useCalendarEvents } from "~/hooks/api/calendar";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { ScrollArea } from "~/components/ui/scroll-area";
import { Badge } from "~/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { EventForm } from "~/components/event-form";
import { Availability } from "~/components/availability";
import { cn } from "~/lib/utils";
import { ChevronLeftIcon, ChevronRightIcon, PlusIcon } from "lucide-react";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

type ViewMode = "month" | "week" | "day";

export default function CalendarPage() {
  const today = new Date();
  const [currentDate, setCurrentDate] = useState(today);
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showAvailability, setShowAvailability] = useState(false);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const timeMin = useMemo(() => {
    const d = new Date(year, month, 1);
    return d.toISOString();
  }, [year, month]);

  const timeMax = useMemo(() => {
    const d = new Date(year, month + 1, 0, 23, 59, 59);
    return d.toISOString();
  }, [year, month]);

  const { data: eventsData, isLoading, isError, error } = useCalendarEvents({
    timeMin,
    timeMax,
    singleEvents: true,
    orderBy: "startTime",
  });

  const events = useMemo(() => eventsData?.items ?? [], [eventsData]);

  function navigate(delta: number) {
    const d = new Date(currentDate);
    if (viewMode === "month") d.setMonth(d.getMonth() + delta);
    else if (viewMode === "week") d.setDate(d.getDate() + 7 * delta);
    else d.setDate(d.getDate() + delta);
    setCurrentDate(d);
  }

  function goToday() {
    setCurrentDate(new Date());
  }

  const calendarGrid = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startPad = firstDay.getDay();
    const totalDays = lastDay.getDate();

    const cells: (number | null)[] = [];
    for (let i = 0; i < startPad; i++) cells.push(null);
    for (let d = 1; d <= totalDays; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [year, month]);

  const eventsByDay = useMemo(() => {
    const map: Record<number, typeof events> = {};
    for (const event of events) {
      const dateStr = event.start?.date ?? event.start?.dateTime ?? "";
      const day = new Date(dateStr).getDate();
      if (!map[day]) map[day] = [];
      map[day].push(event);
    }
    return map;
  }, [events]);

  const weekEvents = useMemo(() => {
    const weekStart = new Date(currentDate);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    return events.filter((e) => {
      const dateStr = e.start?.date ?? e.start?.dateTime ?? "";
      const d = new Date(dateStr);
      return d >= weekStart && d <= weekEnd;
    });
  }, [events, currentDate]);

  const dayEvents = useMemo(() => {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(currentDate.getDate()).padStart(2, "0")}`;
    return events.filter((e) => {
      const d = e.start?.date ?? e.start?.dateTime ?? "";
      return d.startsWith(dateStr);
    });
  }, [events, year, month, currentDate]);

  const isToday = useCallback(
    (day: number) => {
      const d = new Date();
      return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day;
    },
    [year, month]
  );

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between border-b p-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={goToday}>
            Today
          </Button>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon-sm" onClick={() => navigate(-1)}>
              <ChevronLeftIcon className="size-4" />
            </Button>
            <span className="text-sm font-semibold min-w-32 text-center">
              {MONTHS[month]} {year}
            </span>
            <Button variant="ghost" size="icon-sm" onClick={() => navigate(1)}>
              <ChevronRightIcon className="size-4" />
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={viewMode}
            onValueChange={(v: ViewMode) => setViewMode(v)}
          >
            <SelectTrigger className="w-24 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="month">Month</SelectItem>
              <SelectItem value="week">Week</SelectItem>
              <SelectItem value="day">Day</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAvailability(!showAvailability)}
          >
            {showAvailability ? "Hide" : "Availability"}
          </Button>
          <Button size="sm" onClick={() => setShowCreateDialog(true)}>
            <PlusIcon className="size-4 mr-1" />
            New Event
          </Button>
        </div>
      </div>

      {showAvailability && (
        <div className="border-b p-3">
          <Availability />
        </div>
      )}

      <ScrollArea className="flex-1">
        {isLoading ? (
          <div className="space-y-2 p-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-sm">
            <p className="text-destructive font-medium">Failed to load events</p>
            <p className="text-muted-foreground text-xs max-w-md text-center">
              {error?.message ?? "An unknown error occurred"}
            </p>
          </div>
        ) : viewMode === "month" ? (
          <div className="p-3">
            <div className="grid grid-cols-7 gap-px bg-muted rounded-lg overflow-hidden">
              {DAYS.map((day) => (
                <div
                  key={day}
                  className="bg-background p-2 text-xs font-medium text-muted-foreground text-center"
                >
                  {day}
                </div>
              ))}
              {calendarGrid.map((day, i) => (
                <div
                  key={i}
                  className={cn(
                    "bg-background min-h-[80px] p-1 text-sm transition-colors",
                    day ? "hover:bg-muted/50 cursor-pointer" : ""
                  )}
                  onClick={() => {
                    if (day) {
                      setCurrentDate(new Date(year, month, day));
                      setViewMode("day");
                    }
                  }}
                >
                  {day && (
                    <>
                      <span
                        className={cn(
                          "inline-flex items-center justify-center size-6 text-xs rounded-full",
                          isToday(day) && "bg-primary text-primary-foreground font-medium"
                        )}
                      >
                        {day}
                      </span>
                      <div className="mt-1 space-y-0.5">
                        {(eventsByDay[day] ?? []).slice(0, 3).map((event) => (
                          <Link
                            key={event.id}
                            href={`/calendar/${event.id}`}
                            className="block truncate text-[10px] px-1 py-0.5 rounded bg-primary/10 text-primary hover:bg-primary/20"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {event.summary ?? "(untitled)"}
                          </Link>
                        ))}
                        {(eventsByDay[day] ?? []).length > 3 && (
                          <span className="text-[10px] text-muted-foreground px-1">
                            +{(eventsByDay[day] ?? []).length - 3} more
                          </span>
                        )}
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : viewMode === "week" ? (
          <div className="p-3 space-y-2">
            {weekEvents.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
                No events this week
              </div>
            ) : (
              weekEvents.map((event) => (
                <Link
                  key={event.id}
                  href={`/calendar/${event.id}`}
                  className="flex items-center gap-3 rounded-lg border p-3 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex flex-col items-center min-w-12">
                    <span className="text-xs text-muted-foreground">
                      {event.start?.dateTime
                        ? new Date(event.start.dateTime).toLocaleDateString(undefined, { weekday: "short" })
                        : ""}
                    </span>
                    <span className="text-sm font-semibold">
                      {event.start?.dateTime
                        ? new Date(event.start.dateTime).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
                        : "All day"}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {event.summary ?? "(untitled)"}
                    </p>
                    {event.description && (
                      <p className="text-xs text-muted-foreground truncate">
                        {event.description}
                      </p>
                    )}
                  </div>
                  {event.eventType && (
                    <Badge variant="outline" className="text-[10px]">
                      {event.eventType}
                    </Badge>
                  )}
                </Link>
              ))
            )}
          </div>
        ) : (
          <div className="p-3 space-y-2">
            <h2 className="text-sm font-semibold mb-3">
              {currentDate.toLocaleDateString(undefined, {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}
            </h2>
            {dayEvents.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
                No events this day
              </div>
            ) : (
              dayEvents.map((event) => (
                <Link
                  key={event.id}
                  href={`/calendar/${event.id}`}
                  className="flex items-center gap-3 rounded-lg border p-3 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex flex-col items-center min-w-12">
                    <span className="text-sm font-semibold">
                      {event.start?.dateTime
                        ? new Date(event.start.dateTime).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
                        : "All day"}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {event.summary ?? "(untitled)"}
                    </p>
                    {event.location && (
                      <p className="text-xs text-muted-foreground truncate">
                        {event.location}
                      </p>
                    )}
                  </div>
                  {event.eventType && (
                    <Badge variant="outline" className="text-[10px]">
                      {event.eventType}
                    </Badge>
                  )}
                </Link>
              ))
            )}
          </div>
        )}
      </ScrollArea>

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Create Event</DialogTitle>
          </DialogHeader>
          <EventForm onSuccess={() => setShowCreateDialog(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
