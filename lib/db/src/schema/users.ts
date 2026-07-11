import { pgTable, text, serial, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  clerkId: text("clerk_id").unique(), // Clerkからの移行互換性のためNull可能に変更
  username: text("username").unique().notNull(),
  displayName: text("display_name").notNull(),
  name: text("name").notNull(), // Better Auth 標準カラム
  email: text("email").unique().notNull(),
  emailVerified: boolean("email_verified").default(false).notNull(), // Better Auth
  image: text("image"), // Better Auth
  bio: text("bio"),
  avatarUrl: text("avatar_url"),
  headerUrl: text("header_url"),
  birthday: text("birthday"), // YYYY-MM-DD, null until setup complete
  setupComplete: boolean("setup_complete").default(false).notNull(),
  pinnedYudateId: integer("pinned_yudate_id"), // プロフィール固定ユデートのID
  isPrivate: boolean("is_private").default(false).notNull(), // 鍵垢かどうか
  yudedollar: integer("yudedollar").default(0).notNull(), // YD残高
  badgeType: text("badge_type"), // 総合ランキングバッジ ('gold' | 'silver' | 'bronze' | null)
  lastLoginDate: text("last_login_date"), // 最終ログイン日 (JST: YYYY-MM-DD)
  consecutiveLoginDays: integer("consecutive_login_days").default(0).notNull(), // 連続ログイン日数
  rankingOptIn: boolean("ranking_opt_in").default(false).notNull(), // ランキング参加設定
  isVerified: boolean("is_verified").default(false).notNull(), // 公式マークの有無
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const sessionsTable = pgTable("sessions", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
});

export const accountsTable = pgTable("accounts", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"), // パスワード認証用
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
});

export const verificationsTable = pgTable("verifications", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
export type Session = typeof sessionsTable.$inferSelect;
export type Account = typeof accountsTable.$inferSelect;
export type Verification = typeof verificationsTable.$inferSelect;
