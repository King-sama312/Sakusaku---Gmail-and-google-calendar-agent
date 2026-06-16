import { pgTable, uuid, timestamp, text, varchar, index } from "drizzle-orm/pg-core";

import { usersTable } from "./user";

/**
 * A persisted conversation between a user and the Sakusaku assistant.
 * Conversations are scoped to a single user and immutable after creation.
 */
export const conversationsTable = pgTable(
  "conversations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 200 }).notNull().default("New chat"),
    model: varchar("model", { length: 100 }).notNull().default("unknown"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").$onUpdate(() => new Date()),
  },
  (table) => ({
    userIdIdx: index("conversations_user_id_idx").on(table.userId),
  }),
);

/**
 * Individual chat messages within a conversation.
 * Supports user, assistant, and tool-related roles for reconstructing
 * the full message history sent to the LLM.
 */
export const chatMessagesTable = pgTable(
  "chat_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversationsTable.id, { onDelete: "cascade" }),
    role: varchar("role", { length: 20 }).notNull(),
    content: text("content"),
    toolCalls: text("tool_calls"),
    toolCallId: varchar("tool_call_id", { length: 100 }),
    toolName: varchar("tool_name", { length: 100 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    conversationIdIdx: index("chat_messages_conversation_id_idx").on(table.conversationId),
  }),
);

export type SelectConversation = typeof conversationsTable.$inferSelect;
export type InsertConversation = typeof conversationsTable.$inferInsert;

export type SelectChatMessage = typeof chatMessagesTable.$inferSelect;
export type InsertChatMessage = typeof chatMessagesTable.$inferInsert;
