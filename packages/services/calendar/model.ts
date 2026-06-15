import { z } from "zod";

export const eventDateTime = z.object({
  date: z.string().optional().describe('All-day event date in "YYYY-MM-DD" format'),
  dateTime: z.string().optional().describe('RFC 3339 timestamp, e.g. "2024-12-25T10:00:00-07:00"'),
  timeZone: z.string().optional().describe("IANA time zone name"),
});

export const eventAttendee = z.object({
  email: z.string().optional().describe("Attendee's email address"),
  displayName: z.string().optional(),
  optional: z.boolean().optional(),
  responseStatus: z.enum(["needsAction", "declined", "tentative", "accepted"]).optional(),
});

export const eventReminderOverride = z.object({
  method: z.enum(["email", "popup"]),
  minutes: z.number().int().positive(),
});

export const eventReminders = z.object({
  useDefault: z.boolean().optional().describe("Use calendar default reminders"),
  overrides: z.array(eventReminderOverride).optional().describe("Custom reminders"),
});

export const createEventInput = z.object({
  summary: z.string().min(1).describe("Title of the event"),
  description: z.string().optional().describe("Description of the event"),
  location: z.string().optional().describe("Geographic location"),
  start: eventDateTime.describe("Start time of the event"),
  end: eventDateTime.describe("End time of the event"),
  attendees: z.array(eventAttendee).optional().describe("List of attendees"),
  recurrence: z.array(z.string()).optional().describe('RRULE lines, e.g. ["RRULE:FREQ=WEEKLY;COUNT=5"]'),
  colorId: z.string().optional().describe("Color ID (1-11)"),
  transparency: z.enum(["opaque", "transparent"]).optional(),
  visibility: z.enum(["default", "public", "private", "confidential"]).optional(),
  eventType: z.enum(["default", "outOfOffice", "focusTime", "workingLocation"]).optional(),
  status: z.enum(["confirmed", "tentative", "cancelled"]).optional(),
  reminders: eventReminders.optional(),
  guestsCanModify: z.boolean().optional(),
  guestsCanInviteOthers: z.boolean().optional(),
  guestsCanSeeOtherGuests: z.boolean().optional(),
  anyoneCanAddSelf: z.boolean().optional(),
  sendUpdates: z.enum(["all", "externalOnly", "none"]).optional(),
});
export type CreateEventInputType = z.infer<typeof createEventInput>;

export const updateEventInput = z.object({
  eventId: z.string().describe("Event ID to update"),
  summary: z.string().optional().describe("Title of the event"),
  description: z.string().optional(),
  location: z.string().optional(),
  start: eventDateTime.optional(),
  end: eventDateTime.optional(),
  attendees: z.array(eventAttendee).optional(),
  recurrence: z.array(z.string()).optional(),
  colorId: z.string().optional(),
  transparency: z.enum(["opaque", "transparent"]).optional(),
  visibility: z.enum(["default", "public", "private", "confidential"]).optional(),
  eventType: z.enum(["default", "outOfOffice", "focusTime", "workingLocation"]).optional(),
  status: z.enum(["confirmed", "tentative", "cancelled"]).optional(),
  reminders: eventReminders.optional(),
  guestsCanModify: z.boolean().optional(),
  guestsCanInviteOthers: z.boolean().optional(),
  guestsCanSeeOtherGuests: z.boolean().optional(),
  anyoneCanAddSelf: z.boolean().optional(),
  sendUpdates: z.enum(["all", "externalOnly", "none"]).optional(),
});
export type UpdateEventInputType = z.infer<typeof updateEventInput>;

export const listEventsInput = z.object({
  calendarId: z.string().optional().describe('Calendar ID. Defaults to "primary"'),
  timeMin: z.string().optional().describe("Lower bound for event start time (RFC 3339)"),
  timeMax: z.string().optional().describe("Upper bound for event start time (RFC 3339)"),
  timeZone: z.string().optional(),
  singleEvents: z.boolean().optional().describe("Expand recurring events into instances"),
  maxResults: z.number().int().positive().max(2500).optional(),
  pageToken: z.string().optional(),
  q: z.string().optional().describe("Free text search terms"),
  orderBy: z.enum(["startTime", "updated"]).optional(),
  showDeleted: z.boolean().optional(),
});
export type ListEventsInputType = z.infer<typeof listEventsInput>;

export const getEventInput = z.object({
  calendarId: z.string().optional().describe('Calendar ID. Defaults to "primary"'),
  eventId: z.string().describe("Event ID"),
  timeZone: z.string().optional(),
});
export type GetEventInputType = z.infer<typeof getEventInput>;

export const deleteEventInput = z.object({
  calendarId: z.string().optional().describe('Calendar ID. Defaults to "primary"'),
  eventId: z.string().describe("Event ID to delete"),
  sendUpdates: z.enum(["all", "externalOnly", "none"]).optional(),
});
export type DeleteEventInputType = z.infer<typeof deleteEventInput>;

export const getAvailabilityInput = z.object({
  timeMin: z.string().describe("Start of the time range (RFC 3339)"),
  timeMax: z.string().describe("End of the time range (RFC 3339)"),
  timeZone: z.string().optional(),
  items: z
    .array(z.object({ id: z.string() }))
    .optional()
    .describe("Calendars to check. Defaults to primary if omitted."),
});
export type GetAvailabilityInputType = z.infer<typeof getAvailabilityInput>;
