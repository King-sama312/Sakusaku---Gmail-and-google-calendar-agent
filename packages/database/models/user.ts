import { pgTable, uuid, varchar, timestamp, boolean, text, unique } from "drizzle-orm/pg-core";

// ── Core user profile (populated from Google OAuth) ──
export const usersTable = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  fullName: varchar("full_name", { length: 80 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  profileImageUrl: text("profile_image_url"),
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
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    // One Google account can only belong to one user
    providerAccountUnique: unique().on(table.provider, table.providerAccountId),
  }),
);

// Types
export type SelectUser = typeof usersTable.$inferSelect;
export type InsertUser = typeof usersTable.$inferInsert;

export type SelectOauthAccount = typeof oauthAccountsTable.$inferSelect;
export type InsertOauthAccount = typeof oauthAccountsTable.$inferInsert;
