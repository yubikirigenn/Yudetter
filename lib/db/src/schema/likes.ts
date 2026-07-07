import { pgTable, integer, timestamp, primaryKey } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { yudatesTable } from "./yudates";

export const likesTable = pgTable("likes", {
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  yudateId: integer("yudate_id").notNull().references(() => yudatesTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [primaryKey({ columns: [t.userId, t.yudateId] })]);

export type Like = typeof likesTable.$inferSelect;
