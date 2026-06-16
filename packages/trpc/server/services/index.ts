import UserService from "@repo/services/user";
import GmailService from "@repo/services/gmail";
import CalendarService from "@repo/services/calendar";
import ChatService from "@repo/services/chat";

export const userService = new UserService();
export const gmailService = new GmailService();
export const calendarService = new CalendarService();
export const chatService = new ChatService({
  userService,
  gmailService,
  calendarService,
});
