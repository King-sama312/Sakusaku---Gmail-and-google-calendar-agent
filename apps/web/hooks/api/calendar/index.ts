import { trpc } from "~/trpc/client";

export const useCalendarEvents = (input: {
  timeMin?: string;
  timeMax?: string;
  timeZone?: string;
  singleEvents?: boolean;
  maxResults?: number;
  pageToken?: string;
  q?: string;
  orderBy?: "startTime" | "updated";
  showDeleted?: boolean;
}) => {
  return trpc.calendar.listEvents.useQuery(input, {
    enabled: true,
  });
};

export const useCalendarEvent = (input: {
  eventId: string;
  calendarId?: string;
  timeZone?: string;
}) => {
  return trpc.calendar.getEvent.useQuery(input, {
    enabled: !!input.eventId,
  });
};

export const useCreateEvent = () => {
  const utils = trpc.useUtils();
  return trpc.calendar.createEvent.useMutation({
    onSuccess: () => {
      utils.calendar.listEvents.invalidate();
    },
  });
};

export const useUpdateEvent = () => {
  const utils = trpc.useUtils();
  return trpc.calendar.updateEvent.useMutation({
    onSuccess: () => {
      utils.calendar.listEvents.invalidate();
    },
  });
};

export const useDeleteEvent = () => {
  const utils = trpc.useUtils();
  return trpc.calendar.deleteEvent.useMutation({
    onSuccess: () => {
      utils.calendar.listEvents.invalidate();
    },
  });
};

export const useAvailability = () => {
  return trpc.calendar.getAvailability.useMutation();
};
