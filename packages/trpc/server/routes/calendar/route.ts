import { z, zodUndefinedModel } from "../../schema";
import { calendarService } from "../../services";
import { authenticatedProcedure, router } from "../../trpc";
import { generatePath } from "../../utils/path-generator";
import {
  createEventInputModel,
  eventOutputModel,
  updateEventInputModel,
  listEventsInputModel,
  listEventsOutputModel,
  getEventInputModel,
  deleteEventInputModel,
  deleteEventOutputModel,
  getAvailabilityInputModel,
  getAvailabilityOutputModel,
} from "./model";

const TAGS = ["Google Calendar"];
const getPath = generatePath("/calendar");

export const calendarRouter = router({
  listEvents: authenticatedProcedure
    .meta({
      openapi: { method: "GET", path: getPath("/events"), tags: TAGS, protect: true },
    })
    .input(listEventsInputModel)
    .output(listEventsOutputModel)
    .query(async ({ input, ctx }) => {
      return await calendarService.listEvents(ctx.user.id, input);
    }),

  getEvent: authenticatedProcedure
    .meta({
      openapi: { method: "GET", path: getPath("/events/{eventId}"), tags: TAGS, protect: true },
    })
    .input(getEventInputModel)
    .output(eventOutputModel)
    .query(async ({ input, ctx }) => {
      return await calendarService.getEvent(ctx.user.id, input);
    }),

  createEvent: authenticatedProcedure
    .meta({
      openapi: { method: "POST", path: getPath("/events"), tags: TAGS, protect: true },
    })
    .input(createEventInputModel)
    .output(eventOutputModel)
    .mutation(async ({ input, ctx }) => {
      return await calendarService.createEvent(ctx.user.id, input);
    }),

  updateEvent: authenticatedProcedure
    .meta({
      openapi: { method: "PUT", path: getPath("/events/{eventId}"), tags: TAGS, protect: true },
    })
    .input(updateEventInputModel)
    .output(eventOutputModel)
    .mutation(async ({ input, ctx }) => {
      return await calendarService.updateEvent(ctx.user.id, input);
    }),

  deleteEvent: authenticatedProcedure
    .meta({
      openapi: { method: "DELETE", path: getPath("/events/{eventId}"), tags: TAGS, protect: true },
    })
    .input(deleteEventInputModel)
    .output(deleteEventOutputModel)
    .mutation(async ({ input, ctx }) => {
      await calendarService.deleteEvent(ctx.user.id, input);
      return { success: true };
    }),

  getAvailability: authenticatedProcedure
    .meta({
      openapi: { method: "POST", path: getPath("/availability"), tags: TAGS, protect: true },
    })
    .input(getAvailabilityInputModel)
    .output(getAvailabilityOutputModel)
    .mutation(async ({ input, ctx }) => {
      return await calendarService.getAvailability(ctx.user.id, input);
    }),
});
