import { z } from "zod";

export const getAuthenticationMethodOutputSchema = z.object({
  provider: z.enum(["GOOGLE_OAUTH"]),
  displayName: z.string().optional(),
  displayText: z.string().optional(),
  authUrl: z.string(),
});
export type GetAuthenticationMethodOutputSchema = z.infer<
  typeof getAuthenticationMethodOutputSchema
>;


export const createUserWithEmailAndPasswordInput= z.object({
   fullName: z.string().describe('Full name of the user'),
   email: z.email().describe('Email of the user'),
   password: z.string().describe('Password of the user')
})

export type CreateUserWithEmailAndPasswordInputType = z.infer<typeof createUserWithEmailAndPasswordInput>

export const generateUserTokenPayload= z.object({
  id: z.string().describe('uuid of the user')
})

export type GenerateUserTokenPayloadType = z.infer<typeof generateUserTokenPayload>

export const signInUserWithEmailAndPasswordInput = z.object({
  email: z.email().describe("Email of the user"),
  password: z.string().describe("password of the user"),
});

export type SignInUserWithEmailAndPasswordInputType = z.infer<
  typeof signInUserWithEmailAndPasswordInput
>;