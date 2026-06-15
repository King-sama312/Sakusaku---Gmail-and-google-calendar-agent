"use client";

import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Skeleton } from "~/components/ui/skeleton";
import { useAvailability } from "~/hooks/api/calendar";
import { cn } from "~/lib/utils";

type CalendarBusy = { start?: string; end?: string }[];

interface AvailabilityProps {
  timeMin?: string;
  timeMax?: string;
  timeZone?: string;
  className?: string;
}

export function Availability({
  timeMin: defaultTimeMin,
  timeMax: defaultTimeMax,
  timeZone: defaultTimeZone,
  className,
}: AvailabilityProps) {
  const today = new Date();
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - today.getDay());
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);

  const [timeMin, setTimeMin] = useState(
    defaultTimeMin ?? weekStart.toISOString().slice(0, 16)
  );
  const [timeMax, setTimeMax] = useState(
    defaultTimeMax ?? weekEnd.toISOString().slice(0, 16)
  );
  const [timeZone, setTimeZone] = useState(defaultTimeZone ?? "");
  const [result, setResult] = useState<Record<string, { busy?: CalendarBusy }> | null>(null);

  const { mutateAsync: checkAvailability, isPending } = useAvailability();

  async function handleCheck() {
    const res = await checkAvailability({
      timeMin: new Date(timeMin).toISOString(),
      timeMax: new Date(timeMax).toISOString(),
      timeZone: timeZone || undefined,
    });
    setResult(res.calendars ?? null);
  }

  const hasBusySlots = result
    ? Object.values(result).some((cal) => (cal.busy?.length ?? 0) > 0)
    : false;

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <label className="text-xs text-muted-foreground mb-1 block">From</label>
          <Input
            type="datetime-local"
            value={timeMin}
            onChange={(e) => setTimeMin(e.target.value)}
          />
        </div>
        <div className="flex-1">
          <label className="text-xs text-muted-foreground mb-1 block">To</label>
          <Input
            type="datetime-local"
            value={timeMax}
            onChange={(e) => setTimeMax(e.target.value)}
          />
        </div>
        <div className="w-32">
          <label className="text-xs text-muted-foreground mb-1 block">Time Zone</label>
          <Input
            placeholder="UTC"
            value={timeZone}
            onChange={(e) => setTimeZone(e.target.value)}
          />
        </div>
        <Button onClick={handleCheck} disabled={isPending} className="shrink-0">
          {isPending ? "Checking..." : "Check"}
        </Button>
      </div>

      {isPending && (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
      )}

      {result && !isPending && (
        <div className="space-y-3">
          {Object.entries(result).map(([calendarId, calendar]) => (
            <div key={calendarId} className="rounded-lg border p-3">
              <p className="text-sm font-medium mb-2 truncate">{calendarId}</p>
              {!calendar.busy || calendar.busy.length === 0 ? (
                <p className="text-xs text-muted-foreground">No busy slots — all free</p>
              ) : (
                <div className="space-y-1">
                  {calendar.busy.map((slot, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 text-xs text-destructive bg-destructive/5 rounded px-2 py-1"
                    >
                      <span className="size-1.5 rounded-full bg-destructive shrink-0" />
                      <span>
                        {slot.start ? new Date(slot.start).toLocaleString() : "?"}
                        {" — "}
                        {slot.end ? new Date(slot.end).toLocaleString() : "?"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
          {!hasBusySlots && (
            <p className="text-xs text-green-600 font-medium">All calendars are free in this range</p>
          )}
        </div>
      )}
    </div>
  );
}
