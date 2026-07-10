import { pgTable, integer, timestamp, primaryKey, text } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const followsTable = pgTable("follows", {
  followerId: integer("follower_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  followingId: integer("following_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  status: text("status").default("accepted").notNull(), // "pending" | "accepted"
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [primaryKey({ columns: [t.followerId, t.followingId] })]);

export type Follow = typeof followsTable.$inferSelect;
