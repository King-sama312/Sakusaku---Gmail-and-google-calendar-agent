import { pgTable, uuid, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { usersTable } from "./user";

// Local cache of Gmail thread metadata so the inbox can render without
// hitting the Gmail API on every reload.
export const gmailThreadMetadataTable = pgTable(
  "gmail_thread_metadata",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    threadId: text("thread_id").notNull(),
    subject: text("subject"),
    fromAddress: text("from_address"),
    snippet: text("snippet"),
    historyId: text("history_id"),
    labelIds: text("label_ids").array(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("gmail_metadata_user_thread_idx").on(table.userId, table.threadId)],
);

export type SelectGmailThreadMetadata = typeof gmailThreadMetadataTable.$inferSelect;
export type InsertGmailThreadMetadata = typeof gmailThreadMetadataTable.$inferInsert;
