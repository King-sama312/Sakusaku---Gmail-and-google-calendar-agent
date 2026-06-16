import { z } from "zod";

export const getLoggedInUserInfoInputModel = z.undefined();

export const getLoggedInUserInfoOutputModel = z.object({
  id: z.string().describe("uuid of the user"),
  email: z.email().describe("Email of the user"),
  fullName: z.string().describe("Full name of the user"),
  profileImageUrl: z.string().describe("User's profile image url").optional().nullable(),
  emailVerified: z.boolean().describe("Whether the user's email is verified"),
});

export const signOutInputModel = z.object({}).optional();

export const signOutOutputModel = z.object({
  message: z.string().describe("Sign out status message"),
});

export const setAuthCookieInputModel = z.object({
  token: z.string().describe("JWT to set as the auth cookie"),
});

export const setAuthCookieOutputModel = z.object({
  success: z.boolean(),
});
