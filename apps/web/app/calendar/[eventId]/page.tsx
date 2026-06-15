"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useCalendarEvent, useDeleteEvent } from "~/hooks/api/calendar";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { Badge } from "~/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { EventForm } from "~/components/event-form";
import { ChevronLeftIcon } from "lucide-react";

export default function EventDetailPage() {
  const params = useParams<{ eventId: string }>();
  const router = useRouter();
  const [showEditDialog, setShowEditDialog] = useState(false);

  const { data: event, isLoading, isError, error } = useCalendarEvent({
    eventId: params.eventId,
  });

  const { mutateAsync: deleteEvent, isPending: isDeleting } = useDeleteEvent();

  async function handleDelete() {
    if (!window.confirm("Delete this event?")) return;
    await deleteEvent({ eventId: params.eventId });
    router.push("/calendar");
  }

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 p-6">
        <p className="text-destructive font-medium">Failed to load event</p>
        <p className="text-muted-foreground text-xs max-w-md text-center">
          {error?.message ?? "An unknown error occurred"}
        </p>
        <Button variant="outline" size="sm" onClick={() => router.push("/calendar")}>
          Back to Calendar
        </Button>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 p-6">
        <p className="text-muted-foreground">Event not found</p>
        <Button variant="outline" size="sm" onClick={() => router.push("/calendar")}>
          Back to Calendar
        </Button>
      </div>
    );
  }

  const startDate = event.start?.date ?? event.start?.dateTime ?? "";
  const endDate = event.end?.date ?? event.end?.dateTime ?? "";
  const isAllDay = !!event.start?.date;

  return (
    <div className="p-6 max-w-2xl">
      <div className="flex items-center gap-2 mb-6">
        <Link href="/calendar">
          <Button variant="ghost" size="icon-sm">
            <ChevronLeftIcon className="size-4" />
          </Button>
        </Link>
        <h1 className="text-xl font-semibold truncate">
          {event.summary ?? "(untitled)"}
        </h1>
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-2">
          {event.eventType && <Badge variant="secondary">{event.eventType}</Badge>}
          {event.status && (
            <Badge
              variant={event.status === "cancelled" ? "destructive" : "outline"}
            >
              {event.status}
            </Badge>
          )}
        </div>

        <div className="grid gap-1 text-sm">
          <p className="text-muted-foreground">When</p>
          <p className="font-medium">
            {isAllDay ? (
              <>
                {new Date(startDate).toLocaleDateString(undefined, {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
                {endDate && endDate !== startDate && (
                  <> — {new Date(endDate).toLocaleDateString(undefined, {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                  </>
                )}
                <span className="text-muted-foreground ml-1">(All day)</span>
              </>
            ) : (
              <>
                {new Date(startDate).toLocaleDateString(undefined, {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}{" "}
                {new Date(startDate).toLocaleTimeString(undefined, {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
                {" — "}
                {new Date(endDate).toLocaleTimeString(undefined, {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </>
            )}
          </p>
        </div>

        {event.location && (
          <div className="grid gap-1 text-sm">
            <p className="text-muted-foreground">Location</p>
            <p className="font-medium">{event.location}</p>
          </div>
        )}

        {event.description && (
          <div className="grid gap-1 text-sm">
            <p className="text-muted-foreground">Description</p>
            <p className="whitespace-pre-wrap">{event.description}</p>
          </div>
        )}

        {event.attendees && event.attendees.length > 0 && (
          <div className="grid gap-1 text-sm">
            <p className="text-muted-foreground">
              Attendees ({event.attendees.length})
            </p>
            <div className="space-y-1">
              {event.attendees.map((attendee, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <span>{attendee.email ?? attendee.displayName ?? "?"}</span>
                  {attendee.responseStatus && (
                    <Badge variant="outline" className="text-[10px]">
                      {attendee.responseStatus}
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {event.hangoutLink && (
          <div className="grid gap-1 text-sm">
            <p className="text-muted-foreground">Hangout Link</p>
            <a
              href={event.hangoutLink}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline"
            >
              {event.hangoutLink}
            </a>
          </div>
        )}

        <div className="flex items-center gap-2 pt-4 border-t">
          <Button variant="default" size="sm" onClick={() => setShowEditDialog(true)}>
            Edit
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleDelete}
            disabled={isDeleting}
          >
            {isDeleting ? "Deleting..." : "Delete"}
          </Button>
        </div>
      </div>

      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Edit Event</DialogTitle>
          </DialogHeader>
          <EventForm
            event={{
              id: event.id ?? "",
              summary: event.summary,
              description: event.description,
              location: event.location,
              start: event.start,
              end: event.end,
              attendees: event.attendees,
            }}
            onSuccess={() => setShowEditDialog(false)}
            onCancel={() => setShowEditDialog(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
