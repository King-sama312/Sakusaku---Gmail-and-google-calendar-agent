import bcrypt from "bcrypt";
import { randomUUID, randomBytes, createHash } from "node:crypto";
import * as JWT from "jsonwebtoken";
import { db, eq, and, isNull } from "@repo/database";
import {
  passwordsTable,
  usersTable,
  oauthAccountsTable,
  sessionsTable,
  emailVerificationTokensTable,
  passwordResetTokensTable,
} from "@repo/database/schema";
import { env } from "../env";
import { googleOAuth2Client } from "../clients/google-oauth";
import {
  sendVerificationEmail,
  sendPasswordResetEmail,
} from "../lib/email";
import {
  GetAuthenticationMethodOutputSchema,
  type CreateUserWithEmailAndPasswordInputType,
  createUserWithEmailAndPasswordInput,
  GenerateUserTokenPayloadType,
  generateUserTokenPayload,
  SignInUserWithEmailAndPasswordInputType,
  signInUserWithEmailAndPasswordInput,
} from "./model";

class UserService {
  private async getUserByEmail(email: string) {
    const result = await db
      .select()
      .from(usersTable)
      .innerJoin(passwordsTable, eq(usersTable.id, passwordsTable.userId))
      .where(eq(usersTable.email, email));

    if (result.length === 0) return null;

    return result[0];
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

  private async getUserByEmailOnly(email: string) {
    const result = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, email))
      .limit(1);

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
      await db
        .update(oauthAccountsTable)
        .set({
          accessToken: tokens.access_token ?? null,
          refreshToken: tokens.refresh_token ?? null,
        })
        .where(eq(oauthAccountsTable.id, existingOAuthAccount[0]!.id));
    } else {
      const existingUser = await this.getUserByEmailOnly(email);

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

    await db
      .insert(sessionsTable)
      .values({
        userId,
        token: randomUUID(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

    const { token } = await this.generateUserToken({ id: userId });

    return { token, userId };
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

    const { token } = await this.generateUserToken({ id: userId });

    return {
      id: userId,
      email,
      token,
    };
  }

  public async signInUserWithEmailAndPassword(payload: SignInUserWithEmailAndPasswordInputType) {
    const { email, password } = await signInUserWithEmailAndPasswordInput.parseAsync(payload);

    // check if user with email already exist or not
    const existingUser = await this.getUserByEmail(email);
    if (!existingUser) throw new Error(`User with email: ${email} does not exist`);

    const hashedPassword = existingUser.passwords.hash;

    if (!hashedPassword) throw new Error(`Invalid authentication method`);

    // match password hash with bcrypt

    const isMatchingPassword = await bcrypt.compare(password, hashedPassword);
    if (!isMatchingPassword) throw new Error(`Invalid email or password`);

    const userId = existingUser.users.id;

    // generate JWT token for the user

    const { token } = await this.generateUserToken({ id: userId });

    return {
      id: userId,
      token,
    };
  }

  private generateTokenHex(): string {
    return randomBytes(32).toString("hex");
  }

  private hashToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }

  public async sendVerificationEmail(userId: string) {
    const user = await this.getUserInfoByID(userId);

    const rawToken = this.generateTokenHex();
    const tokenHash = this.hashToken(rawToken);

    await db
      .delete(emailVerificationTokensTable)
      .where(eq(emailVerificationTokensTable.userId, userId));

    await db.insert(emailVerificationTokensTable).values({
      userId,
      tokenHash,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });

    await sendVerificationEmail(user.email, rawToken, userId);
  }

  public async verifyEmail(token: string, userId: string) {
    const tokenHash = this.hashToken(token);

    const result = await db
      .select()
      .from(emailVerificationTokensTable)
      .where(
        and(
          eq(emailVerificationTokensTable.userId, userId),
          eq(emailVerificationTokensTable.tokenHash, tokenHash),
          isNull(emailVerificationTokensTable.usedAt),
        ),
      )
      .limit(1);

    if (result.length === 0) throw new Error("Invalid or expired verification token");
    if (result[0]!.expiresAt < new Date()) throw new Error("Verification token has expired");

    await db
      .update(emailVerificationTokensTable)
      .set({ usedAt: new Date() })
      .where(eq(emailVerificationTokensTable.id, result[0]!.id));

    await db
      .update(usersTable)
      .set({ emailVerified: true })
      .where(eq(usersTable.id, userId));
  }

  public async sendPasswordResetEmail(email: string) {
    const user = await this.getUserByEmailOnly(email);
    if (!user) return;

    const rawToken = this.generateTokenHex();
    const tokenHash = this.hashToken(rawToken);

    await db.insert(passwordResetTokensTable).values({
      userId: user.id,
      tokenHash,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });

    await sendPasswordResetEmail(email, rawToken);
  }

  public async resetPassword(token: string, newPassword: string) {
    const tokenHash = this.hashToken(token);

    const result = await db
      .select()
      .from(passwordResetTokensTable)
      .where(
        and(
          eq(passwordResetTokensTable.tokenHash, tokenHash),
          isNull(passwordResetTokensTable.usedAt),
        ),
      )
      .limit(1);

    if (result.length === 0) throw new Error("Invalid or expired reset token");
    if (result[0]!.expiresAt < new Date()) throw new Error("Reset token has expired");

    const hash = await bcrypt.hash(newPassword, 12);

    await db
      .update(passwordResetTokensTable)
      .set({ usedAt: new Date() })
      .where(eq(passwordResetTokensTable.id, result[0]!.id));

    await db
      .update(passwordsTable)
      .set({ hash })
      .where(eq(passwordsTable.userId, result[0]!.userId));

    await db
      .delete(sessionsTable)
      .where(eq(sessionsTable.userId, result[0]!.userId));
  }

  public async verifyAndDecodeUserToken(token: string) {
    const { id } = await this.verifyUserToken(token);
    return { id };
  }
}

export default UserService;
