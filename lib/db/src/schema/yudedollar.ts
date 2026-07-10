import { pgTable, text, serial, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const ydTransactionsTable = pgTable("yd_transactions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  amount: integer("amount").notNull(),
  type: text("type").notNull(), // 'welcome', 'login_bonus', 'post_create', 'post_delete', 'post_view', 'market_buy', 'market_sell', 'market_bid_refund', 'game_fee', 'game_charge', 'ranking_reward'
  description: text("description").notNull(),
  referenceId: integer("reference_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const marketItemsTable = pgTable("market_items", {
  id: serial("id").primaryKey(),
  sellerId: integer("seller_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  buyerId: integer("buyer_id").references(() => usersTable.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  description: text("description"),
  itemType: text("item_type").notNull(), // 'image', 'audio', 'game', 'user_id'
  itemData: text("item_data").notNull(), // image URL, audio URL, game ID, or username
  thumbnailUrl: text("thumbnail_url"),
  price: integer("price").notNull(),
  saleType: text("sale_type").notNull(), // 'normal', 'auction'
  status: text("status").default("selling").notNull(), // 'selling', 'sold', 'reserved', 'completed'
  stock: integer("stock"), // null means infinite, or 1-99
  auctionEndAt: timestamp("auction_end_at"),
  highestBid: integer("highest_bid"),
  highestBidderId: integer("highest_bidder_id").references(() => usersTable.id, { onDelete: "set null" }),
  buyoutPrice: integer("buyout_price"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const marketLikesTable = pgTable("market_likes", {
  id: serial("id").primaryKey(),
  itemId: integer("item_id").notNull().references(() => marketItemsTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const marketCommentsTable = pgTable("market_comments", {
  id: serial("id").primaryKey(),
  itemId: integer("item_id").notNull().references(() => marketItemsTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  comment: text("comment").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const gamesTable = pgTable("games", {
  id: serial("id").primaryKey(),
  creatorId: integer("creator_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  htmlContent: text("html_content").notNull(),
  playPrice: integer("play_price").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const rankingResetsTable = pgTable("ranking_resets", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(), // 'daily', 'weekly'
  lastResetKey: text("last_reset_key").notNull(), // 'YYYY-MM-DD', 'YYYY-WW'
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
