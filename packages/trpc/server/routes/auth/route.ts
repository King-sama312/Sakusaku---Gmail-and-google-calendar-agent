import { userService } from "../../services";
import { authenticatedProcedure, publicProcedure, router } from "../../trpc";
import { generatePath } from "../../utils/path-generator";
import {
  getLoggedInUserInfoInputModel,
  getLoggedInUserInfoOutputModel,
  setAuthCookieInputModel,
  setAuthCookieOutputModel,
  signOutInputModel,
  signOutOutputModel,
} from "./model";
import { clearAuthenticationCookie, setAuthenticationCookie } from "../../utils/cookie";

const TAGS = ["Authentication"];
const getPath = generatePath("/authentication");

export const authRouter = router({
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
        protect: true,
      },
    })
    .input(getLoggedInUserInfoInputModel)
    .output(getLoggedInUserInfoOutputModel)
    .query(async ({ ctx }) => {
      const { email, fullName, id, profileImageUrl, emailVerified } =
        await userService.getUserInfoByID(ctx.user.id);

      return { id, email, fullName, profileImageUrl, emailVerified };
    }),
});
