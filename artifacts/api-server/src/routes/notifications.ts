import { Router } from "express";
import { eq, desc, and, lt } from "drizzle-orm";
import { db, notificationsTable, usersTable, yudatesTable } from "@workspace/db";
import { requireAuth } from "../lib/auth";
import { buildUserProfile, buildYudate } from "../lib/buildResponse";

const router = Router();

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

  const items = await Promise.all(
    pageRows.map(async (n) => {
      const [actor, yudate] = await Promise.all([
        buildUserProfile(n.actorId, req.dbUserId),
        n.yudateId ? buildYudate(n.yudateId, req.dbUserId) : Promise.resolve(null),
      ]);
      return {
        id: n.id,
        type: n.type,
        actor,
        yudate,
        read: n.read,
        createdAt: n.createdAt.toISOString(),
      };
    }),
  );

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
