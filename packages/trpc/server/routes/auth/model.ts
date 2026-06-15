import { z } from "zod";

export const createUserWithEmailAndPasswordInputModel = z.object({
  fullName: z.string().describe("Full name of the user"),
  email: z.email().describe("Email of the user"),
  password: z.string().describe("Password of the user"),
});

export const createUserWithEmailAndPasswordOutputModel = z.object({
    id: z.string().describe('id of the user created'),
    email: z.email().describe('email of the user created'),
})

export const signInUserWithEmailAndPasswordInputModel = z.object({
  email: z.email().describe("Email of the user"),
  password: z.string().describe("Password of the user")
})

export const signInUserWithEmailAndPasswordOutputModel = z.object({
  id: z.string().describe("uuid of the user"),
})

export const getLoggedInUserInfoInputModel = z.undefined()

export const getLoggedInUserInfoOutputModel = z.object({
id: z.string().describe("uuid of the user"),
  email: z.email().describe("Email of the user"),
  fullName: z.string().describe("Full name of the user"),
profileImageUrl: z.string().describe("User's profile image url").optional().nullable(),
emailVerified: z.boolean().describe("Whether the user's email is verified")
})

export const signOutInputModel = z.object({}).optional()

export const signOutOutputModel = z.object({
  message: z.string().describe("Sign out status message"),
})

export const setAuthCookieInputModel = z.object({
  token: z.string().describe("JWT to set as the auth cookie"),
})

export const setAuthCookieOutputModel = z.object({
  success: z.boolean(),
})

export const sendVerificationEmailInputModel = z.object({
  userId: z.string().describe("ID of the user to send verification to"),
})

export const sendVerificationEmailOutputModel = z.object({
  success: z.boolean(),
})

export const verifyEmailInputModel = z.object({
  token: z.string().describe("Verification token from email"),
  userId: z.string().describe("ID of the user"),
})

export const verifyEmailOutputModel = z.object({
  success: z.boolean(),
})

export const sendPasswordResetEmailInputModel = z.object({
  email: z.email().describe("Email to send reset link to"),
})

export const sendPasswordResetEmailOutputModel = z.object({
  success: z.boolean(),
})

export const resetPasswordInputModel = z.object({
  token: z.string().describe("Reset token from email"),
  password: z.string().min(8).describe("New password"),
})

export const resetPasswordOutputModel = z.object({
  success: z.boolean(),
})