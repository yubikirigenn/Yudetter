import { Router } from "express";
import { eq, desc, and, lt } from "drizzle-orm";
import { db, notificationsTable, usersTable, yudatesTable } from "@workspace/db";
import { requireAuth } from "../lib/auth";
import { buildUserProfile, buildYudate, buildUserProfilesBulk, buildYudatePage } from "../lib/buildResponse";
import { sseManager } from "../lib/sse";

const router = Router();

// GET /notifications/stream (SSE)
router.get("/notifications/stream", requireAuth, (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  // Send an initial heartbeat
  res.write(":\n\n");

  sseManager.addClient(req.dbUserId!, res);
});

// GET /notifications
router.get("/notifications", requireAuth, async (req, res): Promise<void> => {
  const limit = 30;
  const cursor = req.query.cursor ? Number(req.query.cursor) : null;

  const rows = await db
    .select()
    .from(notificationsTable)
    .where(
      and(
        eq(notificationsTable.userId, req.dbUserId!),
        cursor ? lt(notificationsTable.id, cursor) : undefined,
      ),
    )
    .orderBy(desc(notificationsTable.id))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const pageRows = rows.slice(0, limit);
  const nextCursor = hasMore ? pageRows[pageRows.length - 1].id : null;

  // 1. 全てのアクターIDとユデートIDを一括収集
  const actorIds = Array.from(new Set(pageRows.map((n) => n.actorId)));
  const yudateIds = Array.from(
    new Set(pageRows.map((n) => n.yudateId).filter((id): id is number => id !== null && id !== undefined))
  );

  // 2. アクターのプロフィールを一括取得 (N+1回避)
  const actorProfileMap = actorIds.length > 0
    ? await buildUserProfilesBulk(actorIds, req.dbUserId)
    : new Map();

  // 3. 紐づく投稿（yudate）を一括取得 (N+1回避)
  const yudatePage = yudateIds.length > 0
    ? await buildYudatePage(yudateIds, req.dbUserId, null)
    : { items: [] };
  const yudateMap = new Map(yudatePage.items.map((y) => [y.id, y]));

  // 4. レスポンスの組み立て
  const items = pageRows.map((n) => {
    const actor = actorProfileMap.get(n.actorId) || null;
    const yudate = n.yudateId ? (yudateMap.get(n.yudateId) || null) : null;
    return {
      id: n.id,
      type: n.type,
      actor,
      yudate,
      read: n.read,
      createdAt: n.createdAt.toISOString(),
    };
  });

  res.json({ items, nextCursor });
});

// POST /notifications/read - mark all read
router.post("/notifications/read", requireAuth, async (req, res): Promise<void> => {
  await db
    .update(notificationsTable)
    .set({ read: true })
    .where(
      and(
        eq(notificationsTable.userId, req.dbUserId!),
        eq(notificationsTable.read, false),
      ),
    );
  res.json({ success: true });
});

// GET /notifications/unread-count
router.get("/notifications/unread-count", requireAuth, async (req, res): Promise<void> => {
  const { sql } = await import("drizzle-orm");
  const [result] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(notificationsTable)
    .where(
      and(
        eq(notificationsTable.userId, req.dbUserId!),
        eq(notificationsTable.read, false),
      ),
    );
  res.json({ count: result?.count ?? 0 });
});

export default router;
