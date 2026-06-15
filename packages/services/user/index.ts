import bcrypt from "bcrypt";
import { randomUUID } from "node:crypto";
import * as JWT from "jsonwebtoken"
import { db, eq, and } from "@repo/database";
import {
  passwordsTable,
  usersTable,
  oauthAccountsTable,
  sessionsTable,
} from "@repo/database/schema";
import { env } from "../env";
import { googleOAuth2Client } from "../clients/google-oauth";
import { signJwt, SEVEN_DAYS_MS } from "../lib/jwt";
import {
  GetAuthenticationMethodOutputSchema,
  type CreateUserWithEmailAndPasswordInputType,
  createUserWithEmailAndPasswordInput,
  GenerateUserTokenPayloadType,
  generateUserTokenPayload,
} from "./model";

class UserService {
  private async getUserByEmail(email: string) {
    const result = await db.select().from(usersTable).where(eq(usersTable.email, email));
    if (!result || result.length === 0) return null;
    return result[0];
  }

  private async generateUserToken(payload: GenerateUserTokenPayloadType){
    const {id} =await  generateUserTokenPayload.parseAsync(payload)
    const token= JWT.sign({id}, env.JWT_SECRET)
    return {token}

  }

  public async getAuthenticationMethods(): Promise<
    ReadonlyArray<GetAuthenticationMethodOutputSchema>
  > {
    const supportedAuthenticationProviders: GetAuthenticationMethodOutputSchema[] = [];

    const isGoogleConfigured = !!(env.GOOGLE_OAUTH_CLIENT_ID && env.GOOGLE_OAUTH_CLIENT_SECRET);

    if (isGoogleConfigured) {
      const url = googleOAuth2Client.generateAuthUrl({
        access_type: "offline",
        prompt: "consent",
        scope: ["openid", "profile", "email"],
      });
      supportedAuthenticationProviders.push({
        provider: "GOOGLE_OAUTH",
        displayName: "Google",
        displayText: "Signin with Google",
        authUrl: url,
      });
    }

    return supportedAuthenticationProviders;
  }

  public async googleSignup(code: string) {
    const { tokens } = await googleOAuth2Client.getToken(code);

    const ticket = await googleOAuth2Client.verifyIdToken({
      idToken: tokens.id_token!,
      audience: env.GOOGLE_OAUTH_CLIENT_ID,
    });

    const payload = ticket.getPayload()!;
    const googleId = payload.sub;
    const email = payload.email!;
    const fullName = payload.name ?? "Unknown";
    const profileImageUrl = payload.picture;

    const existingOAuthAccount = await db
      .select()
      .from(oauthAccountsTable)
      .where(
        and(
          eq(oauthAccountsTable.provider, "google"),
          eq(oauthAccountsTable.providerAccountId, googleId),
        ),
      )
      .limit(1);

    let userId: string;

    if (existingOAuthAccount.length > 0) {
      userId = existingOAuthAccount[0].userId;
      await db
        .update(oauthAccountsTable)
        .set({
          accessToken: tokens.access_token ?? null,
          refreshToken: tokens.refresh_token ?? null,
        })
        .where(eq(oauthAccountsTable.id, existingOAuthAccount[0].id));
    } else {
      const existingUser = await this.getUserByEmail(email);

      if (existingUser) {
        userId = existingUser.id;
      } else {
        const userResult = await db
          .insert(usersTable)
          .values({ fullName, email, profileImageUrl, emailVerified: true })
          .returning({ id: usersTable.id });

        if (!userResult || userResult.length === 0)
          throw new Error("Something went wrong while creating the user");

        userId = userResult[0]!.id;
      }

      await db.insert(oauthAccountsTable).values({
        userId,
        provider: "google",
        providerAccountId: googleId,
        accessToken: tokens.access_token ?? null,
        refreshToken: tokens.refresh_token ?? null,
      });
    }

    const sessionResult = await db
      .insert(sessionsTable)
      .values({
        userId,
        token: randomUUID(), // unique constraint placeholder; real auth is via JWT
        expiresAt: new Date(Date.now() + SEVEN_DAYS_MS),
      })
      .returning({ id: sessionsTable.id });

    const sessionId = sessionResult[0]!.id;
    const jwtToken = signJwt({ userId, sessionId });

    return { sessionToken: jwtToken, userId };
  }

  public async createUserwithEmailAndPassword(payload: CreateUserWithEmailAndPasswordInputType) {
    const { fullName, email, password } =
      await createUserWithEmailAndPasswordInput.parseAsync(payload);

    // check if user with email already exist or not
    const existingUserWithEmail = await this.getUserByEmail(email);
    if (existingUserWithEmail) throw new Error(`User with email: ${email} already exists`);

    // Hash password with bcrypt
    const hash = await bcrypt.hash(password, 12);

    // Insert user in db
    const userInsertResult = await db
      .insert(usersTable)
      .values({ fullName, email })
      .returning({ id: usersTable.id });

    if (!userInsertResult || userInsertResult.length === 0)
      throw new Error(`Something went wrong while creating the user`);

    const userId = userInsertResult[0]!.id;
    await db.insert(passwordsTable).values({ userId, hash });

    const {token} = await this.generateUserToken({id:userId})
    
    return{
      id:userId,
      token   
    }
  }
}

export default UserService;
