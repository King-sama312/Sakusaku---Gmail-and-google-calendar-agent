import { corsair } from "../corsair";
import {
  type CreateEventInputType,
  createEventInput,
  type UpdateEventInputType,
  updateEventInput,
  type ListEventsInputType,
  listEventsInput,
  type GetEventInputType,
  getEventInput,
  type DeleteEventInputType,
  deleteEventInput,
  type GetAvailabilityInputType,
  getAvailabilityInput,
} from "./model";

class CalendarService {
  private tenant(userId: string) {
    return corsair.withTenant(userId);
  }

  async createEvent(userId: string, params: CreateEventInputType) {
    const {
      summary,
      description,
      location,
      start,
      end,
      attendees,
      recurrence,
      colorId,
      transparency,
      visibility,
      eventType,
      status,
      reminders,
      guestsCanModify,
      guestsCanInviteOthers,
      guestsCanSeeOtherGuests,
      anyoneCanAddSelf,
      sendUpdates,
    } = await createEventInput.parseAsync(params);
    return this.tenant(userId).googlecalendar.api.events.create({
      event: {
        summary,
        description,
        location,
        start,
        end,
        attendees,
        recurrence,
        colorId,
        transparency,
        visibility,
        eventType,
        status,
        reminders,
        guestsCanModify,
        guestsCanInviteOthers,
        guestsCanSeeOtherGuests,
        anyoneCanAddSelf,
      },
      sendUpdates,
    });
  }

  async updateEvent(userId: string, params: UpdateEventInputType) {
    const {
      eventId,
      summary,
      description,
      location,
      start,
      end,
      attendees,
      recurrence,
      colorId,
      transparency,
      visibility,
      eventType,
      status,
      reminders,
      guestsCanModify,
      guestsCanInviteOthers,
      guestsCanSeeOtherGuests,
      anyoneCanAddSelf,
      sendUpdates,
    } = await updateEventInput.parseAsync(params);
    return this.tenant(userId).googlecalendar.api.events.update({
      id: eventId,
      event: {
        summary,
        description,
        location,
        start,
        end,
        attendees,
        recurrence,
        colorId,
        transparency,
        visibility,
        eventType,
        status,
        reminders,
        guestsCanModify,
        guestsCanInviteOthers,
        guestsCanSeeOtherGuests,
        anyoneCanAddSelf,
      },
      sendUpdates,
    });
  }

  async listEvents(userId: string, params: ListEventsInputType) {
    const {
      calendarId,
      timeMin,
      timeMax,
      timeZone,
      singleEvents,
      maxResults,
      pageToken,
      q,
      orderBy,
      showDeleted,
    } = await listEventsInput.parseAsync(params);
    return this.tenant(userId).googlecalendar.api.events.getMany({
      calendarId,
      timeMin,
      timeMax,
      timeZone,
      singleEvents,
      maxResults,
      pageToken,
      q,
      orderBy,
      showDeleted,
    });
  }

  async getEvent(userId: string, params: GetEventInputType) {
    const { calendarId, eventId, timeZone } = await getEventInput.parseAsync(params);
    return this.tenant(userId).googlecalendar.api.events.get({
      calendarId,
      id: eventId,
      timeZone,
    });
  }

  async deleteEvent(userId: string, params: DeleteEventInputType) {
    const { calendarId, eventId, sendUpdates } = await deleteEventInput.parseAsync(params);
    return this.tenant(userId).googlecalendar.api.events.delete({
      calendarId,
      id: eventId,
      sendUpdates,
    });
  }

  async getAvailability(userId: string, params: GetAvailabilityInputType) {
    const { timeMin, timeMax, timeZone, items } = await getAvailabilityInput.parseAsync(params);
    return this.tenant(userId).googlecalendar.api.calendar.getAvailability({
      timeMin,
      timeMax,
      timeZone,
      items,
    });
  }
}

export default CalendarService;
