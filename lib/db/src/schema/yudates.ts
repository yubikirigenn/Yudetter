import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const yudatesTable = pgTable("yudates", {
  id: serial("id").primaryKey(),
  content: text("content").notNull(),
  authorId: integer("author_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  quotedYudateId: integer("quoted_yudate_id"),
  replyToId: integer("reply_to_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertYudateSchema = createInsertSchema(yudatesTable).omit({ id: true, createdAt: true });
export type InsertYudate = z.infer<typeof insertYudateSchema>;
export type Yudate = typeof yudatesTable.$inferSelect;
