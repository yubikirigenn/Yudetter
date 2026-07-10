import { pgTable, serial, integer, timestamp, primaryKey, index } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { yudatesTable } from "./yudates";

export const reyudatesTable = pgTable("reyudates", {
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  originalYudateId: integer("original_yudate_id").notNull().references(() => yudatesTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  primaryKey({ columns: [t.userId, t.originalYudateId] }),
  index("reyudates_original_yudate_id_idx").on(t.originalYudateId),
]);

export type Reyudate = typeof reyudatesTable.$inferSelect;
