import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  boolean,
  text,
  unique,
  index,
} from "drizzle-orm/pg-core";

// ── Core user profile (no auth secrets here) ──
export const usersTable = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  fullName: varchar("full_name", { length: 80 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  emailVerified: boolean("email_verified").default(false),
  profileImageUrl: text("profile_image_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").$onUpdate(() => new Date()),
});

// ── Local password (1-to-1 with users) ──
export const passwordsTable = pgTable("passwords", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" })
    .unique(), // one password record per user
  hash: text("hash").notNull(), // bcrypt string
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").$onUpdate(() => new Date()),
});

// ── Linked OAuth accounts (1-to-many with users) ──
export const oauthAccountsTable = pgTable(
  "oauth_accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    provider: varchar("provider", { length: 50 }).notNull(), // 'google'
    providerAccountId: varchar("provider_account_id", { length: 255 }).notNull(),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    expiresAt: timestamp("expires_at"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    // One Google account can only belong to one user
    providerAccountUnique: unique().on(table.provider, table.providerAccountId),
  })
);

// ── Server-side sessions (recommended over JWT) ──
export const sessionsTable = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    token: varchar("token", { length: 255 }).notNull().unique(),
    expiresAt: timestamp("expires_at").notNull(),
    ipAddress: varchar("ip_address", { length: 45 }),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    tokenIdx: index().on(table.token),
    userIdIdx: index().on(table.userId),
  })
);

// ── Email verification tokens ──
export const emailVerificationTokensTable = pgTable(
  "email_verification_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" })
      .unique(), // one active verification flow per user
    tokenHash: text("token_hash").notNull(), // sha256 of the token sent via email
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow(),
    usedAt: timestamp("used_at"),
  }
);

// ── Password reset tokens ──
export const passwordResetTokensTable = pgTable(
  "password_reset_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow(),
    usedAt: timestamp("used_at"),
  }
);

// Types
export type SelectUser = typeof usersTable.$inferSelect;
export type InsertUser = typeof usersTable.$inferInsert;

export type SelectPassword = typeof passwordsTable.$inferSelect;
export type InsertPassword = typeof passwordsTable.$inferInsert;

export type SelectOauthAccount = typeof oauthAccountsTable.$inferSelect;
export type InsertOauthAccount = typeof oauthAccountsTable.$inferInsert;

export type SelectSession = typeof sessionsTable.$inferSelect;
export type InsertSession = typeof sessionsTable.$inferInsert;

export type SelectEmailVerificationToken = typeof emailVerificationTokensTable.$inferSelect;
export type InsertEmailVerificationToken = typeof emailVerificationTokensTable.$inferInsert;

export type SelectPasswordResetToken = typeof passwordResetTokensTable.$inferSelect;
export type InsertPasswordResetToken = typeof passwordResetTokensTable.$inferInsert;