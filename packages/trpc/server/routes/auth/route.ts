import { z, zodUndefinedModel } from "../../schema";
import { userService } from "../../services";
import { getAuthenticationMethodOutputSchema } from "@repo/services/user/model";
import { authenticatedProcedure, publicProcedure, router } from "../../trpc";
import { generatePath } from "../../utils/path-generator";
import {
  createUserWithEmailAndPasswordInputModel,
  createUserWithEmailAndPasswordOutputModel,
  getLoggedInUserInfoInputModel,
  getLoggedInUserInfoOutputModel,
  sendVerificationEmailInputModel,
  sendVerificationEmailOutputModel,
  verifyEmailInputModel,
  verifyEmailOutputModel,
  sendPasswordResetEmailInputModel,
  sendPasswordResetEmailOutputModel,
  resetPasswordInputModel,
  resetPasswordOutputModel,
  setAuthCookieInputModel,
  setAuthCookieOutputModel,
  signInUserWithEmailAndPasswordInputModel,
  signInUserWithEmailAndPasswordOutputModel,
  signOutInputModel,
  signOutOutputModel,
} from "./model";
import { clearAuthenticationCookie, setAuthenticationCookie } from "../../utils/cookie";

const TAGS = ["Authentication"];
const getPath = generatePath("/authentication");

export const authRouter = router({
  getSupportedAuthenticationProviders: publicProcedure
    .meta({ openapi: { method: "GET", path: getPath("/supported-providers"), tags: TAGS } })
    .input(zodUndefinedModel)
    .output(z.readonly(z.array(getAuthenticationMethodOutputSchema)))
    .query(async () => {
      const supportedMethods = await userService.getAuthenticationMethods();
      return supportedMethods;
    }),

  createUserWithEmailAndPassword: publicProcedure
    .meta({
      openapi: { method: "POST", path: getPath("/createUserWithEmailAndPassword"), tags: TAGS },
    })
    .input(createUserWithEmailAndPasswordInputModel)
    .output(createUserWithEmailAndPasswordOutputModel)
    .mutation(async ({ input, ctx }) => {
      const { fullName, email, password } = input;
      const { id, email: userEmail, token } = await userService.createUserwithEmailAndPassword({
        fullName,
        email,
        password,
      });

      setAuthenticationCookie(ctx, token);

      userService.sendVerificationEmail(id).catch(() => {
        // fire-and-forget — don't fail signup if email send fails
      });

      return { id, email: userEmail };
    }),

  signInUserWithEmailAndPassword: publicProcedure
    .meta({
      openapi: { method: "POST", path: getPath("/signInWithEmailAndPassword"), tags: TAGS },
    })
    .input(signInUserWithEmailAndPasswordInputModel)
    .output(signInUserWithEmailAndPasswordOutputModel)
    .mutation(async ({ input, ctx }) => {
      const { email, password } = input;
      const { id, token } = await userService.signInUserWithEmailAndPassword({
        email,
        password,
      });

      setAuthenticationCookie(ctx, token);
      return { id };
    }),

      signOut: publicProcedure
    .meta({
      openapi: {
        method: "POST",
        path: getPath("/signOut"),
        tags: TAGS,
      },
    })
    .input(signOutInputModel)
    .output(signOutOutputModel)
    .mutation(async ({ ctx }) => {
      clearAuthenticationCookie(ctx);

      return { message: "Signed out successfully" };
    }),

  sendVerificationEmail: authenticatedProcedure
    .meta({
      openapi: {
        method: "POST",
        path: getPath("/sendVerificationEmail"),
        tags: TAGS,
        protect: true,
      },
    })
    .input(sendVerificationEmailInputModel)
    .output(sendVerificationEmailOutputModel)
    .mutation(async ({ input }) => {
      await userService.sendVerificationEmail(input.userId);
      return { success: true };
    }),

  verifyEmail: publicProcedure
    .meta({
      openapi: {
        method: "POST",
        path: getPath("/verifyEmail"),
        tags: TAGS,
      },
    })
    .input(verifyEmailInputModel)
    .output(verifyEmailOutputModel)
    .mutation(async ({ input }) => {
      await userService.verifyEmail(input.token, input.userId);
      return { success: true };
    }),

  sendPasswordResetEmail: publicProcedure
    .meta({
      openapi: {
        method: "POST",
        path: getPath("/sendPasswordResetEmail"),
        tags: TAGS,
      },
    })
    .input(sendPasswordResetEmailInputModel)
    .output(sendPasswordResetEmailOutputModel)
    .mutation(async ({ input }) => {
      await userService.sendPasswordResetEmail(input.email);
      return { success: true };
    }),

  resetPassword: publicProcedure
    .meta({
      openapi: {
        method: "POST",
        path: getPath("/resetPassword"),
        tags: TAGS,
      },
    })
    .input(resetPasswordInputModel)
    .output(resetPasswordOutputModel)
    .mutation(async ({ input }) => {
      await userService.resetPassword(input.token, input.password);
      return { success: true };
    }),

  setAuthCookie: publicProcedure
    .meta({
      openapi: {
        method: "POST",
        path: getPath("/setAuthCookie"),
        tags: TAGS,
      },
    })
    .input(setAuthCookieInputModel)
    .output(setAuthCookieOutputModel)
    .mutation(async ({ input, ctx }) => {
      setAuthenticationCookie(ctx, input.token);
      return { success: true };
    }),

    getLoggedInUserInfo: authenticatedProcedure
    .meta({
      openapi: {
        method: "GET",
        path: "/getLoggedInUserInfo",
        tags: TAGS,
        protect:true
      },
    })
    .input(getLoggedInUserInfoInputModel)
    .output(getLoggedInUserInfoOutputModel)
    .query(async ({ ctx }) => {
     
     const {email,fullName,id,profileImageUrl,emailVerified}=   await userService.getUserInfoByID(ctx.user.id);

      return { id, email, fullName, profileImageUrl, emailVerified };
    }),

});
