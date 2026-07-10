import { pgTable, text, integer, timestamp, primaryKey } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { yudatesTable } from "./yudates";

export const reactionsTable = pgTable("reactions", {
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  yudateId: integer("yudate_id").notNull().references(() => yudatesTable.id, { onDelete: "cascade" }),
  emoji: text("emoji").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [primaryKey({ columns: [t.userId, t.yudateId, t.emoji] })]);

export type Reaction = typeof reactionsTable.$inferSelect;
