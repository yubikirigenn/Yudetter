import { Router } from "express";
import { desc, asc, and, isNull, ilike, or, sql, eq, count, lte, gt } from "drizzle-orm";
import { db, yudatesTable, usersTable, likesTable } from "@workspace/db";
import { optionalAuth } from "../lib/auth";
import { buildYudatePage, buildUserProfile } from "../lib/buildResponse";
import { getBlockedUserIds } from "../lib/blocks";
import { notInArray } from "drizzle-orm";

const router = Router();

// GET /explore/popular - popular yudates by like count
router.get("/explore/popular", optionalAuth, async (req, res): Promise<void> => {
  const limit = Math.min(Number(req.query.limit) || 20, 50);

  const now = new Date();
  const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);
  const blockedIds = await getBlockedUserIds(req.dbUserId);
  const blockCondition = blockedIds.length > 0 ? notInArray(yudatesTable.authorId, blockedIds) : undefined;
  const rows = await db
    .select({ id: yudatesTable.id, likeCount: count(likesTable.yudateId) })
    .from(yudatesTable)
    .leftJoin(likesTable, eq(likesTable.yudateId, yudatesTable.id))
    .where(
      and(
        isNull(yudatesTable.replyToId),
        eq(yudatesTable.visibility, "public"),
        or(isNull(yudatesTable.scheduledFor), lte(yudatesTable.scheduledFor, now)),
        or(isNull(yudatesTable.autoDeleteAt), gt(yudatesTable.autoDeleteAt, now)),
        blockCondition
      )
    )
    .groupBy(yudatesTable.id)
    .orderBy(
      sql`CASE WHEN ${yudatesTable.createdAt} >= ${fortyEightHoursAgo} AND count(${likesTable.yudateId}) >= 1 THEN 1 ELSE 0 END DESC`,
      desc(count(likesTable.yudateId)),
      desc(yudatesTable.id)
    )
    .limit(limit);

  const page = await buildYudatePage(rows.map((r) => r.id), req.dbUserId, null);
  res.json(page);
});

// GET /explore - trending / recent public yudates
router.get("/explore", optionalAuth, async (req, res): Promise<void> => {
  const limit = Math.min(Number(req.query.limit) || 20, 50);
  const cursor = req.query.cursor ? Number(req.query.cursor) : null;

  const { lt } = await import("drizzle-orm");

  const now = new Date();

  const blockedIds = await getBlockedUserIds(req.dbUserId);
  const blockCondition = blockedIds.length > 0 ? notInArray(yudatesTable.authorId, blockedIds) : undefined;

  const rows = await db
    .select({ id: yudatesTable.id })
    .from(yudatesTable)
    .where(
      and(
        isNull(yudatesTable.replyToId),
        cursor ? lt(yudatesTable.id, cursor) : undefined,
        eq(yudatesTable.visibility, "public"),
        or(isNull(yudatesTable.scheduledFor), lte(yudatesTable.scheduledFor, now)),
        or(isNull(yudatesTable.autoDeleteAt), gt(yudatesTable.autoDeleteAt, now)),
        blockCondition
      ),
    )
    .orderBy(desc(yudatesTable.id))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const ids = rows.slice(0, limit).map((r) => r.id);
  const nextCursor = hasMore ? ids[ids.length - 1] : null;

  const page = await buildYudatePage(ids, req.dbUserId, nextCursor);
  res.json(page);
});

// GET /explore/search?q=...&type=latest|popular|oldest|users|all
router.get("/explore/search", optionalAuth, async (req, res): Promise<void> => {
  const q = (req.query.q as string)?.trim();
  const type = (req.query.type as string) || "all";

  if (!q) {
    res.json({ yudates: [], users: [] });
    return;
  }

  const pattern = `%${q}%`;
  const blockedIds = await getBlockedUserIds(req.dbUserId);
  const blockCondition = blockedIds.length > 0 ? notInArray(yudatesTable.authorId, blockedIds) : undefined;
  const now = new Date();

  let yudateIds: number[] = [];
  let userRows: { id: number }[] = [];

  if (type === "users" || type === "all") {
    userRows = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(
        or(
          ilike(usersTable.username, pattern),
          ilike(usersTable.displayName, pattern),
        ),
      )
      .limit(50);
  }

  if (type !== "users") {
    if (type === "popular") {
      const rows = await db
        .select({ id: yudatesTable.id, likeCount: count(likesTable.yudateId) })
        .from(yudatesTable)
        .leftJoin(likesTable, eq(likesTable.yudateId, yudatesTable.id))
        .where(
          and(
            ilike(yudatesTable.content, pattern),
            isNull(yudatesTable.replyToId),
            eq(yudatesTable.visibility, "public"),
            or(isNull(yudatesTable.scheduledFor), lte(yudatesTable.scheduledFor, now)),
            or(isNull(yudatesTable.autoDeleteAt), gt(yudatesTable.autoDeleteAt, now)),
            blockCondition
          )
        )
        .groupBy(yudatesTable.id)
        .orderBy(
          sql`CASE WHEN ${yudatesTable.createdAt} >= ${fortyEightHoursAgo} AND count(${likesTable.yudateId}) >= 1 THEN 1 ELSE 0 END DESC`,
          desc(count(likesTable.yudateId)),
          desc(yudatesTable.id)
        )
        .limit(40);
      yudateIds = rows.map(r => r.id);
    } else {
      const isOldest = type === "oldest";
      const rows = await db
        .select({ id: yudatesTable.id })
        .from(yudatesTable)
        .where(
          and(
            ilike(yudatesTable.content, pattern),
            isNull(yudatesTable.replyToId),
            eq(yudatesTable.visibility, "public"),
            or(isNull(yudatesTable.scheduledFor), lte(yudatesTable.scheduledFor, now)),
            or(isNull(yudatesTable.autoDeleteAt), gt(yudatesTable.autoDeleteAt, now)),
            blockCondition
          )
        )
        .orderBy(isOldest ? asc(yudatesTable.id) : desc(yudatesTable.id))
        .limit(40);
      yudateIds = rows.map(r => r.id);
    }
  }

  const [yudates, users] = await Promise.all([
    buildYudatePage(yudateIds, req.dbUserId, null),
    Promise.all(userRows.map((r) => buildUserProfile(r.id, req.dbUserId))),
  ]);

  res.json({
    yudates: yudates.items,
    users: users.filter(Boolean),
  });
});

// GET /explore/trends - dynamic trending topics aggregated from posts
router.get("/explore/trends", async (req, res): Promise<void> => {
  try {
    const yudates = await db
      .select({ content: yudatesTable.content })
      .from(yudatesTable)
      .where(isNull(yudatesTable.replyToId))
      .orderBy(desc(yudatesTable.id))
      .limit(200);

    const counts: Record<string, number> = {};
    const stopWords = new Set([
      "これ", "それ", "あれ", "この", "その", "あの", "こと", "もの", "ため", "よう",
      "そう", "とき", "ユーザー", "ユデート", "Yudetter", "yudetter", "投稿", "自分",
      "です", "ます", "する", "ある", "いる", "やった", "きた", "した", "いい", "思う",
      "そこ", "ここ", "どこ", "こちら", "そちら", "あちら", "どちら", "記事", "ブログ",
      "さん", "ちゃん", "くん", "から", "まで", "より"
    ]);

    for (const y of yudates) {
      // 1. ハッシュタグの抽出（重み: 2）- #からスペースまで全体をタグとして扱う
      const tags = y.content.match(/#([^\s]+)/g);
      if (tags) {
        for (const tag of tags) {
          const cleanTag = tag.replace(/^#/, "").trim();
          if (cleanTag && cleanTag.length >= 1 && !stopWords.has(cleanTag)) {
            const displayTag = `#${cleanTag}`;
            counts[displayTag] = (counts[displayTag] || 0) + 2;
          }
        }
      }

      // 2. 本文から単語（2文字以上の漢字、カタカナの連続、または3文字以上の英単語）を抽出
      const words = y.content.match(/[\u4e00-\u9faf]{2,}|[a-zA-Z0-9_-]{3,}|[\u30a0-\u30ff]{2,}/g);
      if (words) {
        for (const word of words) {
          const cleanWord = word.trim();
          if (cleanWord && !stopWords.has(cleanWord) && !cleanWord.startsWith("#")) {
            counts[cleanWord] = (counts[cleanWord] || 0) + 1;
          }
        }
      }
    }

    const trends = Object.entries(counts)
      .map(([topic, count]) => ({ topic, posts: count }))
      .sort((a, b) => b.posts - a.posts)
      .slice(0, 5);

    const formattedTrends = trends.map(t => ({
      topic: t.topic,
      posts: t.posts.toLocaleString()
    }));

    res.json(formattedTrends);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to fetch trends" });
  }
});

export default router;
