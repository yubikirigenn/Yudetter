import { Router } from "express";
import { eq, desc, and, isNull } from "drizzle-orm";
import { db, yudatesTable, likesTable, reyudatesTable, notificationsTable, usersTable } from "@workspace/db";
import {
  CreateYudateBody,
  GetYudateParams,
  DeleteYudateParams,
  LikeYudateParams,
  UnlikeYudateParams,
  ReyudateParams,
  UnReyudateParams,
  GetYudateRepliesParams,
  ReplyToYudateParams,
  ReplyToYudateBody,
} from "@workspace/api-zod";
import { requireAuth, optionalAuth } from "../lib/auth";
import { buildYudate, buildYudatePage } from "../lib/buildResponse";

const router = Router();

// GET /yudates - home timeline
router.get("/yudates", optionalAuth, async (req, res): Promise<void> => {
  const limit = Math.min(Number(req.query.limit) || 20, 50);
  const cursor = req.query.cursor ? Number(req.query.cursor) : null;

  // If authenticated, show following + own. Otherwise show recent public.
  let rows;
  if (req.dbUserId) {
    const { followsTable } = await import("@workspace/db");
    const { sql, inArray } = await import("drizzle-orm");

    // Get followed user IDs
    const followed = await db
      .select({ followingId: followsTable.followingId })
      .from(followsTable)
      .where(eq(followsTable.followerId, req.dbUserId));

    const followedIds = followed.map((f) => f.followingId);
    const authorIds = [...followedIds, req.dbUserId];

    const { inArray: inArrayFn, lt } = await import("drizzle-orm");
    rows = await db
      .select({ id: yudatesTable.id })
      .from(yudatesTable)
      .where(
        and(
          inArrayFn(yudatesTable.authorId, authorIds),
          isNull(yudatesTable.replyToId),
          cursor ? lt(yudatesTable.id, cursor) : undefined,
        ),
      )
      .orderBy(desc(yudatesTable.id))
      .limit(limit + 1);
  } else {
    const { lt } = await import("drizzle-orm");
    rows = await db
      .select({ id: yudatesTable.id })
      .from(yudatesTable)
      .where(
        and(
          isNull(yudatesTable.replyToId),
          cursor ? lt(yudatesTable.id, cursor) : undefined,
        ),
      )
      .orderBy(desc(yudatesTable.id))
      .limit(limit + 1);
  }

  const hasMore = rows.length > limit;
  const ids = rows.slice(0, limit).map((r) => r.id);
  const nextCursor = hasMore ? ids[ids.length - 1] : null;

  const page = await buildYudatePage(ids, req.dbUserId, nextCursor);
  res.json(page);
});

// POST /yudates - create yudate
router.post("/yudates", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateYudateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [yudate] = await db
    .insert(yudatesTable)
    .values({
      content: parsed.data.content,
      authorId: req.dbUserId!,
      quotedYudateId: parsed.data.quotedYudateId ?? null,
    })
    .returning();

  // Notify quoted yudate author
  if (parsed.data.quotedYudateId) {
    const [quoted] = await db
      .select({ authorId: yudatesTable.authorId })
      .from(yudatesTable)
      .where(eq(yudatesTable.id, parsed.data.quotedYudateId))
      .limit(1);
    if (quoted && quoted.authorId !== req.dbUserId) {
      await db.insert(notificationsTable).values({
        userId: quoted.authorId,
        type: "quote",
        actorId: req.dbUserId!,
        yudateId: yudate.id,
      });
    }
  }

  const result = await buildYudate(yudate.id, req.dbUserId);
  res.status(201).json(result);
});

// GET /yudates/:id
router.get("/yudates/:id", optionalAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const result = await buildYudate(id, req.dbUserId);
  if (!result) { res.status(404).json({ error: "Not found" }); return; }
  res.json(result);
});

// DELETE /yudates/:id
router.delete("/yudates/:id", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [yudate] = await db.select().from(yudatesTable).where(eq(yudatesTable.id, id)).limit(1);
  if (!yudate) { res.status(404).json({ error: "Not found" }); return; }
  if (yudate.authorId !== req.dbUserId) { res.status(403).json({ error: "Forbidden" }); return; }

  await db.delete(yudatesTable).where(eq(yudatesTable.id, id));
  res.status(204).send();
});

// POST /yudates/:id/like
router.post("/yudates/:id/like", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [yudate] = await db.select().from(yudatesTable).where(eq(yudatesTable.id, id)).limit(1);
  if (!yudate) { res.status(404).json({ error: "Not found" }); return; }

  try {
    await db.insert(likesTable).values({ userId: req.dbUserId!, yudateId: id });
    // Notify author
    if (yudate.authorId !== req.dbUserId) {
      await db.insert(notificationsTable).values({
        userId: yudate.authorId,
        type: "like",
        actorId: req.dbUserId!,
        yudateId: id,
      }).onConflictDoNothing();
    }
  } catch {
    // already liked - ignore
  }
  res.json({ success: true });
});

// DELETE /yudates/:id/like
router.delete("/yudates/:id/like", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  await db.delete(likesTable).where(
    and(eq(likesTable.userId, req.dbUserId!), eq(likesTable.yudateId, id)),
  );
  res.json({ success: true });
});

// POST /yudates/:id/reyudate
router.post("/yudates/:id/reyudate", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [yudate] = await db.select().from(yudatesTable).where(eq(yudatesTable.id, id)).limit(1);
  if (!yudate) { res.status(404).json({ error: "Not found" }); return; }

  try {
    await db.insert(reyudatesTable).values({ userId: req.dbUserId!, originalYudateId: id });
    if (yudate.authorId !== req.dbUserId) {
      await db.insert(notificationsTable).values({
        userId: yudate.authorId,
        type: "reyudate",
        actorId: req.dbUserId!,
        yudateId: id,
      }).onConflictDoNothing();
    }
  } catch {
    // already reyudated - ignore
  }
  res.json({ success: true });
});

// DELETE /yudates/:id/reyudate
router.delete("/yudates/:id/reyudate", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  await db.delete(reyudatesTable).where(
    and(eq(reyudatesTable.userId, req.dbUserId!), eq(reyudatesTable.originalYudateId, id)),
  );
  res.json({ success: true });
});

// GET /yudates/:id/replies
router.get("/yudates/:id/replies", optionalAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const rows = await db
    .select({ id: yudatesTable.id })
    .from(yudatesTable)
    .where(eq(yudatesTable.replyToId, id))
    .orderBy(desc(yudatesTable.id))
    .limit(50);

  const page = await buildYudatePage(rows.map((r) => r.id), req.dbUserId, null);
  res.json(page);
});

// POST /yudates/:id/replies - reply to yudate
router.post("/yudates/:id/replies", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const parsed = ReplyToYudateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [original] = await db.select().from(yudatesTable).where(eq(yudatesTable.id, id)).limit(1);
  if (!original) { res.status(404).json({ error: "Not found" }); return; }

  const [reply] = await db
    .insert(yudatesTable)
    .values({ content: parsed.data.content, authorId: req.dbUserId!, replyToId: id })
    .returning();

  if (original.authorId !== req.dbUserId) {
    await db.insert(notificationsTable).values({
      userId: original.authorId,
      type: "reply",
      actorId: req.dbUserId!,
      yudateId: reply.id,
    });
  }

  const result = await buildYudate(reply.id, req.dbUserId);
  res.status(201).json(result);
});

export default router;
