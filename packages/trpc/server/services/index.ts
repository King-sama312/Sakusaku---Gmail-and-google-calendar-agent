import UserService from "@repo/services/user";
import GmailService from "@repo/services/gmail";
import CalendarService from "@repo/services/calendar";

export const userService = new UserService();
export const gmailService = new GmailService();
export const calendarService = new CalendarService();
