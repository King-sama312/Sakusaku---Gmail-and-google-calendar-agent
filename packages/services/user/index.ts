import * as JWT from "jsonwebtoken";
import { db, eq, and } from "@repo/database";
import { usersTable, oauthAccountsTable } from "@repo/database/schema";
import { env } from "../env";
import { googleOAuth2Client } from "../clients/google-oauth";
import { GenerateUserTokenPayloadType, generateUserTokenPayload } from "./model";

class UserService {
  public async getUserInfoByID(id: string) {
    const user = await db
      .select({
        id: usersTable.id,
        email: usersTable.email,
        fullName: usersTable.fullName,
        profileImageUrl: usersTable.profileImageUrl,
        emailVerified: usersTable.emailVerified,
      })
      .from(usersTable)
      .where(eq(usersTable.id, id));

    if (!user || user.length === 0) throw new Error(`User with id = ${id} does not exist`);

    return user[0]!;
  }

  private async getUserByEmailOnly(email: string) {
    const result = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);

    if (result.length === 0) return null;
    return result[0];
  }

  public async googleSignup(code: string) {
    const { tokens } = await googleOAuth2Client.getToken(code);
    const idToken = tokens.id_token;
    if (!idToken) throw new Error("Missing ID token from Google");

    const ticket = await googleOAuth2Client.verifyIdToken({
      idToken,
      audience: env.GOOGLE_OAUTH_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload) throw new Error("Failed to get Google user payload");

    const googleId = payload.sub;
    if (!googleId) throw new Error("Missing Google user ID");

    const email = payload.email;
    if (!email) throw new Error("Missing email from Google account");

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
      userId = existingOAuthAccount[0]!.userId;
      // Refresh profile data on every login
      await db
        .update(usersTable)
        .set({ fullName, profileImageUrl, emailVerified: true })
        .where(eq(usersTable.id, userId));
    } else {
      const existingUser = await this.getUserByEmailOnly(email);

      if (existingUser) {
        userId = existingUser.id;
        await db
          .update(usersTable)
          .set({ fullName, profileImageUrl, emailVerified: true })
          .where(eq(usersTable.id, userId));
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
      });
    }

    const { token } = await this.generateUserToken({ id: userId });

    return {
      token,
      userId,
      accessToken: tokens.access_token ?? null,
      refreshToken: tokens.refresh_token ?? null,
      expiresIn: (tokens as unknown as { expires_in?: number }).expires_in ?? null,
    };
  }

  private async generateUserToken(payload: GenerateUserTokenPayloadType) {
    const { id } = await generateUserTokenPayload.parseAsync(payload);
    const token = JWT.sign({ id }, env.JWT_SECRET);
    return { token };
  }

  private async verifyUserToken(token: string): Promise<GenerateUserTokenPayloadType> {
    try {
      const verificationResult = JWT.verify(token, env.JWT_SECRET) as GenerateUserTokenPayloadType;
      return verificationResult;
    } catch (error) {
      throw new Error(`Invalid Token`);
    }
  }

  public async verifyAndDecodeUserToken(token: string) {
    const { id } = await this.verifyUserToken(token);
    return { id };
  }
}

export default UserService;
