import { pgTable, text, integer, timestamp, serial, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { groupsTable } from "./groups";

export const messageTypeEnum = pgEnum("message_type", ["text", "image", "file", "audio", "video"]);

export const messagesTable = pgTable("messages", {
  id: serial("id").primaryKey(),
  content: text("content"),
  fileUrl: text("file_url"),
  fileType: text("file_type"),
  fileName: text("file_name"),
  messageType: messageTypeEnum("message_type").notNull().default("text"),
  senderId: text("sender_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  groupId: integer("group_id").references(() => groupsTable.id, { onDelete: "cascade" }),
  recipientId: text("recipient_id").references(() => usersTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertMessageSchema = createInsertSchema(messagesTable).omit({ id: true, createdAt: true });
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messagesTable.$inferSelect;
