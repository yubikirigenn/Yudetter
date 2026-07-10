import { pgTable, text, serial, integer, timestamp, boolean, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const yudatesTable = pgTable("yudates", {
  id: serial("id").primaryKey(),
  content: text("content").notNull(),
  imageUrl: text("image_url"),
  authorId: integer("author_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  quotedYudateId: integer("quoted_yudate_id"),
  replyToId: integer("reply_to_id"),
  scheduledFor: timestamp("scheduled_for"),
  autoDeleteAt: timestamp("auto_delete_at"),
  visibility: text("visibility", { enum: ["public", "followers"] }).default("public").notNull(),
  isSpoiler: boolean("is_spoiler").default(false).notNull(), // 閲覧注意フラグ
  superYudateAmount: integer("super_yudate_amount").default(0).notNull(), // スーパーユデート金額 (投げ銭)
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("yudates_author_id_idx").on(t.authorId),
  index("yudates_reply_to_id_idx").on(t.replyToId),
  index("yudates_quoted_yudate_id_idx").on(t.quotedYudateId),
]);

export const insertYudateSchema = createInsertSchema(yudatesTable).omit({ id: true, createdAt: true });
export type InsertYudate = z.infer<typeof insertYudateSchema>;
export type Yudate = typeof yudatesTable.$inferSelect;
