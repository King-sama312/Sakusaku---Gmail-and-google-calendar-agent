import { z } from "zod";

const eventDateTimeModel = z.object({
  date: z.string().optional(),
  dateTime: z.string().optional(),
  timeZone: z.string().optional(),
});

const eventAttendeeModel = z.object({
  id: z.string().optional(),
  email: z.string().optional(),
  displayName: z.string().optional(),
  organizer: z.boolean().optional(),
  self: z.boolean().optional(),
  resource: z.boolean().optional(),
  optional: z.boolean().optional(),
  responseStatus: z.enum(["needsAction", "declined", "tentative", "accepted"]).optional(),
  comment: z.string().optional(),
  additionalGuests: z.number().optional(),
});

export const createEventInputModel = z.object({
  summary: z.string().min(1).describe("Event title"),
  description: z.string().optional().describe("Event description"),
  location: z.string().optional(),
  start: eventDateTimeModel.describe("Start time"),
  end: eventDateTimeModel.describe("End time"),
  attendees: z.array(eventAttendeeModel).optional(),
  recurrence: z.array(z.string()).optional(),
  colorId: z.string().optional(),
  transparency: z.enum(["opaque", "transparent"]).optional(),
  visibility: z.enum(["default", "public", "private", "confidential"]).optional(),
  eventType: z.enum(["default", "outOfOffice", "focusTime", "workingLocation"]).optional(),
  status: z.enum(["confirmed", "tentative", "cancelled"]).optional(),
  sendUpdates: z.enum(["all", "externalOnly", "none"]).optional(),
});

export const eventOutputModel = z.object({
  id: z.string().optional(),
  status: z.string().optional(),
  htmlLink: z.string().optional(),
  created: z.string().optional(),
  updated: z.string().optional(),
  summary: z.string().optional(),
  description: z.string().optional(),
  location: z.string().optional(),
  creator: z.object({ id: z.string().optional(), email: z.string().optional(), displayName: z.string().optional(), self: z.boolean().optional() }).optional(),
  organizer: z.object({ id: z.string().optional(), email: z.string().optional(), displayName: z.string().optional(), self: z.boolean().optional() }).optional(),
  start: eventDateTimeModel.optional(),
  end: eventDateTimeModel.optional(),
  recurrence: z.array(z.string()).optional(),
  attendees: z.array(eventAttendeeModel).optional(),
  hangoutLink: z.string().optional(),
  eventType: z.string().optional(),
});

export const updateEventInputModel = z.object({
  eventId: z.string().describe("Event ID to update"),
  summary: z.string().optional(),
  description: z.string().optional(),
  location: z.string().optional(),
  start: eventDateTimeModel.optional(),
  end: eventDateTimeModel.optional(),
  attendees: z.array(eventAttendeeModel).optional(),
  recurrence: z.array(z.string()).optional(),
  colorId: z.string().optional(),
  transparency: z.enum(["opaque", "transparent"]).optional(),
  visibility: z.enum(["default", "public", "private", "confidential"]).optional(),
  eventType: z.enum(["default", "outOfOffice", "focusTime", "workingLocation"]).optional(),
  status: z.enum(["confirmed", "tentative", "cancelled"]).optional(),
  sendUpdates: z.enum(["all", "externalOnly", "none"]).optional(),
});

export const listEventsInputModel = z.object({
  calendarId: z.string().optional(),
  timeMin: z.string().optional(),
  timeMax: z.string().optional(),
  timeZone: z.string().optional(),
  singleEvents: z.boolean().optional(),
  maxResults: z.number().int().positive().max(2500).optional(),
  pageToken: z.string().optional(),
  q: z.string().optional(),
  orderBy: z.enum(["startTime", "updated"]).optional(),
  showDeleted: z.boolean().optional(),
});

export const listEventsOutputModel = z.object({
  kind: z.string().optional(),
  etag: z.string().optional(),
  summary: z.string().optional(),
  description: z.string().optional(),
  updated: z.string().optional(),
  timeZone: z.string().optional(),
  accessRole: z.string().optional(),
  nextPageToken: z.string().optional(),
  nextSyncToken: z.string().optional(),
  items: z.array(eventOutputModel).optional(),
});

export const getEventInputModel = z.object({
  calendarId: z.string().optional(),
  eventId: z.string().describe("Event ID"),
  timeZone: z.string().optional(),
});

export const deleteEventInputModel = z.object({
  calendarId: z.string().optional(),
  eventId: z.string().describe("Event ID to delete"),
  sendUpdates: z.enum(["all", "externalOnly", "none"]).optional(),
});

export const deleteEventOutputModel = z.object({
  success: z.boolean(),
});

export const getAvailabilityInputModel = z.object({
  timeMin: z.string().describe("Start of time range (RFC 3339)"),
  timeMax: z.string().describe("End of time range (RFC 3339)"),
  timeZone: z.string().optional(),
  items: z.array(z.object({ id: z.string() })).optional(),
});

export const getAvailabilityOutputModel = z.object({
  kind: z.string().optional(),
  timeMin: z.string().optional(),
  timeMax: z.string().optional(),
  calendars: z.record(z.string(), z.object({
    busy: z.array(z.object({ start: z.string().optional(), end: z.string().optional() })).optional(),
  })).optional(),
});
