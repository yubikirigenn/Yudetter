import { Router } from "express";
import { eq, desc, and, isNull, lte, gt, or, inArray } from "drizzle-orm";
import { z } from "zod";
import { db, yudatesTable, likesTable, reyudatesTable, notificationsTable, usersTable, reactionsTable } from "@workspace/db";
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
import { getBlockedUserIds } from "../lib/blocks";
import { notInArray } from "drizzle-orm";
import { buildYudate, buildYudatePage } from "../lib/buildResponse";
import { sseManager } from "../lib/sse";
import { checkAndApplyPostBonus, applyPostDeletePenalty, checkAndApplyViewBonus } from "../lib/yudedollar";

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
      .where(
        and(
          eq(followsTable.followerId, req.dbUserId),
          eq(followsTable.status, "accepted")
        )
      );

    const followedIds = followed.map((f) => f.followingId);
    const authorIds = [...followedIds, req.dbUserId];

    const { inArray: inArrayFn, lt } = await import("drizzle-orm");
    const now = new Date();
  const blockedIds = await getBlockedUserIds(req.dbUserId);
  const blockCondition = blockedIds.length > 0 ? notInArray(yudatesTable.authorId, blockedIds) : undefined;
    rows = await db
      .select({ id: yudatesTable.id })
      .from(yudatesTable)
      .where(
        and(
          inArrayFn(yudatesTable.authorId, authorIds),
          isNull(yudatesTable.replyToId),
          cursor ? lt(yudatesTable.id, cursor) : undefined,
          or(isNull(yudatesTable.scheduledFor), lte(yudatesTable.scheduledFor, now)),
          or(isNull(yudatesTable.autoDeleteAt), gt(yudatesTable.autoDeleteAt, now)),
          blockCondition,
        ),
      )
      .orderBy(desc(yudatesTable.id))
      .limit(limit + 1);
  } else {
    const { lt } = await import("drizzle-orm");
    const now = new Date();
    rows = await db
      .select({ id: yudatesTable.id })
      .from(yudatesTable)
      .innerJoin(usersTable, eq(yudatesTable.authorId, usersTable.id))
      .where(
        and(
          isNull(yudatesTable.replyToId),
          cursor ? lt(yudatesTable.id, cursor) : undefined,
          eq(yudatesTable.visibility, "public"),
          or(eq(usersTable.isPrivate, false), isNull(usersTable.isPrivate)),
          or(isNull(yudatesTable.scheduledFor), lte(yudatesTable.scheduledFor, now)),
          or(isNull(yudatesTable.autoDeleteAt), gt(yudatesTable.autoDeleteAt, now)),
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
      imageUrl: parsed.data.imageUrl ?? null,
      authorId: req.dbUserId!,
      quotedYudateId: parsed.data.quotedYudateId ?? null,
      scheduledFor: parsed.data.scheduledFor ? new Date(parsed.data.scheduledFor) : null,
      autoDeleteAt: parsed.data.autoDeleteAt ? new Date(parsed.data.autoDeleteAt) : null,
      visibility: parsed.data.visibility ?? "public",
      isSpoiler: parsed.data.isSpoiler ?? false,
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

  // 投稿ボーナスの適用 (5YD)
  try {
    await checkAndApplyPostBonus(req.dbUserId!, yudate.id);
  } catch (e) {
    console.error("Failed to apply post creation YD bonus", e);
  }

  const result = await buildYudate(yudate.id, req.dbUserId);
  res.status(201).json(result);
});

// GET /yudates/:id
router.get("/yudates/:id", optionalAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  // ログイン中なら閲覧ボーナスを適用
  if (req.dbUserId) {
    try {
      await checkAndApplyViewBonus(req.dbUserId, id);
    } catch (e) {
      console.error("Failed to apply post view YD bonus", e);
    }
  }

  const result = await buildYudate(id, req.dbUserId);
  if (!result) { res.status(404).json({ error: "Not found" }); return; }

  const now = new Date();
  if (result.author.id !== req.dbUserId) {
    // 投稿者の非公開（鍵垢）チェック
    const [author] = await db
      .select({ isPrivate: usersTable.isPrivate })
      .from(usersTable)
      .where(eq(usersTable.id, result.author.id))
      .limit(1);

    if (author && author.isPrivate) {
      if (!req.dbUserId) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      const [follow] = await db
        .select()
        .from(followsTable)
        .where(
          and(
            eq(followsTable.followerId, req.dbUserId),
            eq(followsTable.followingId, result.author.id),
            eq(followsTable.status, "accepted")
          )
        )
        .limit(1);
      if (!follow) {
        res.status(404).json({ error: "Not found" });
        return;
      }
    }

    if (result.scheduledFor && new Date(result.scheduledFor) > now) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    if (result.autoDeleteAt && new Date(result.autoDeleteAt) <= now) {
      res.status(404).json({ error: "Not found" });
      return;
    }
  }

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

  // 投稿削除ペナルティの適用 (-5YD) - リプライは対象外
  if (yudate.replyToId === null) {
    try {
      await applyPostDeletePenalty(req.dbUserId!, id);
    } catch (e) {
      console.error("Failed to apply post deletion penalty", e);
    }
  }

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

      sseManager.notifyUser(yudate.authorId, {
        type: "like",
        actorName: req.user?.name || "誰か",
        actionMessage: "があなたのユデートをいいねしました",
      });
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

  await db.delete(notificationsTable).where(
    and(
      eq(notificationsTable.type, "like"),
      eq(notificationsTable.actorId, req.dbUserId!),
      eq(notificationsTable.yudateId, id)
    )
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

      sseManager.notifyUser(yudate.authorId, {
        type: "reyudate",
        actorName: req.user?.name || "誰か",
        actionMessage: "があなたのユデートをリユデートしました",
      });
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

  await db.delete(notificationsTable).where(
    and(
      eq(notificationsTable.type, "reyudate"),
      eq(notificationsTable.actorId, req.dbUserId!),
      eq(notificationsTable.yudateId, id)
    )
  );

  res.json({ success: true });
});

// GET /yudates/:id/replies
router.get("/yudates/:id/replies", optionalAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  // 1. 直接の返信 (子リプライ)
  const childRows = await db
    .select({ id: yudatesTable.id })
    .from(yudatesTable)
    .where(eq(yudatesTable.replyToId, id))
    .orderBy(desc(yudatesTable.superYudateAmount), desc(yudatesTable.id))
    .limit(30);

  const childIds = childRows.map((r) => r.id);

  // 2. 子リプライに対する返信 (孫リプライ)
  let grandChildIds: number[] = [];
  if (childIds.length > 0) {
    const grandChildRows = await db
      .select({ id: yudatesTable.id })
      .from(yudatesTable)
      .where(inArray(yudatesTable.replyToId, childIds))
      .orderBy(desc(yudatesTable.superYudateAmount), desc(yudatesTable.id))
      .limit(30);
    grandChildIds = grandChildRows.map((r) => r.id);
  }

  const allIds = Array.from(new Set([...childIds, ...grandChildIds]));
  if (allIds.length === 0) {
    res.json({ items: [] });
    return;
  }

  const page = await buildYudatePage(allIds, req.dbUserId, null);
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

  const superAmount = (parsed.data as any).superYudateAmount ? Number((parsed.data as any).superYudateAmount) : 0;
  if (superAmount > 0) {
    if (superAmount < 1 || superAmount > 100000) {
      res.status(400).json({ error: "スーパーユデートは 1 YD から 100,000 YD の間で指定してください" });
      return;
    }

    if (original.replyToId !== null) {
      res.status(400).json({ error: "返信に対する返信にはスーパーユデートを設定できません" });
      return;
    }

    if (original.authorId === req.dbUserId) {
      res.status(400).json({ error: "自分の投稿にはスーパーユデートできません" });
      return;
    }

    const [buyer] = await db
      .select({ yudedollar: usersTable.yudedollar })
      .from(usersTable)
      .where(eq(usersTable.id, req.dbUserId!))
      .limit(1);

    if (!buyer || buyer.yudedollar < superAmount) {
      res.status(400).json({ error: "YD残高が不足しています" });
      return;
    }

    const { addYudedollar } = await import("../lib/yudedollar");
    await db.transaction(async (tx) => {
      await addYudedollar(
        req.dbUserId!,
        -superAmount,
        "super_yudate_spend",
        `スーパーユデート送信: ${parsed.data.content.slice(0, 15)}...`,
        id,
        tx,
      );

      await addYudedollar(
        original.authorId,
        superAmount,
        "super_yudate_receive",
        `スーパーユデート受信: ${parsed.data.content.slice(0, 15)}...`,
        id,
        tx,
      );
    });
  }

  const [reply] = await db
    .insert(yudatesTable)
    .values({
      content: parsed.data.content,
      imageUrl: parsed.data.imageUrl ?? null,
      authorId: req.dbUserId!,
      replyToId: id,
      superYudateAmount: superAmount,
      isSpoiler: parsed.data.isSpoiler ?? false,
    })
    .returning();

  if (original.authorId !== req.dbUserId) {
    const isSuper = superAmount > 0;
    const notificationType = isSuper ? `super_yudate:${superAmount}` : "reply";

    await db.insert(notificationsTable).values({
      userId: original.authorId,
      type: notificationType,
      actorId: req.dbUserId!,
      yudateId: reply.id,
    });

    sseManager.notifyUser(original.authorId, {
      type: isSuper ? "super_yudate" : "reply",
      actorName: req.user?.name || "誰か",
      actionMessage: isSuper 
        ? `があなたに ${superAmount} YD のスーパーユデートを送信しました`
        : "があなたのユデートに返信しました",
    });
  }

  const result = await buildYudate(reply.id, req.dbUserId);
  res.status(201).json(result);
});

// POST /yudates/:id/reactions - add emoji reaction
router.post("/yudates/:id/reactions", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const { emoji } = req.body;
  if (!emoji || typeof emoji !== "string") {
    res.status(400).json({ error: "emoji は必須です。" });
    return;
  }

  const [yudate] = await db.select().from(yudatesTable).where(eq(yudatesTable.id, id)).limit(1);
  if (!yudate) { res.status(404).json({ error: "Not found" }); return; }

  try {
    await db.insert(reactionsTable).values({
      userId: req.dbUserId!,
      yudateId: id,
      emoji,
    });
  } catch {
    // Already reacted with this emoji — ignore
  }
  res.json({ success: true });
});

// DELETE /yudates/:id/reactions/:emoji - remove emoji reaction
router.delete("/yudates/:id/reactions/:emoji", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const emoji = Array.isArray(req.params.emoji) ? req.params.emoji[0] : req.params.emoji;

  await db.delete(reactionsTable).where(
    and(
      eq(reactionsTable.userId, req.dbUserId!),
      eq(reactionsTable.yudateId, id),
      eq(reactionsTable.emoji, emoji),
    ),
  );
  res.json({ success: true });
});

// PATCH /yudates/:id - 編集用
router.patch("/yudates/:id", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const parsed = z.object({
    content: z.string().min(1),
    imageUrl: z.string().nullable().optional()
  }).safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  // 自分の投稿であることを確認
  const [yudate] = await db
    .select()
    .from(yudatesTable)
    .where(and(eq(yudatesTable.id, id), eq(yudatesTable.authorId, req.dbUserId!)))
    .limit(1);

  if (!yudate) {
    res.status(403).json({ error: "自分のユデートのみ編集できます" });
    return;
  }

  await db
    .update(yudatesTable)
    .set({
      content: parsed.data.content,
      imageUrl: parsed.data.imageUrl !== undefined ? parsed.data.imageUrl : yudate.imageUrl,
    })
    .where(eq(yudatesTable.id, id));

  const result = await buildYudate(id, req.dbUserId);
  res.json(result);
});

// POST /yudates/:id/pin - プロフィール固定
router.post("/yudates/:id/pin", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  // 自分の投稿であることを確認
  const [yudate] = await db
    .select()
    .from(yudatesTable)
    .where(and(eq(yudatesTable.id, id), eq(yudatesTable.authorId, req.dbUserId!)))
    .limit(1);

  if (!yudate) {
    res.status(403).json({ error: "自分のユデートのみ固定できます" });
    return;
  }

  await db
    .update(usersTable)
    .set({ pinnedYudateId: id })
    .where(eq(usersTable.id, req.dbUserId!));

  res.json({ success: true });
});

// POST /yudates/:id/unpin - プロフィール固定解除
router.post("/yudates/:id/unpin", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  await db
    .update(usersTable)
    .set({ pinnedYudateId: null })
    .where(and(eq(usersTable.id, req.dbUserId!), eq(usersTable.pinnedYudateId, id)));

  res.json({ success: true });
});

// POST /yudates/:id/report - 通報
router.post("/yudates/:id/report", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [yudate] = await db.select().from(yudatesTable).where(eq(yudatesTable.id, id)).limit(1);
  if (!yudate) {
    res.status(404).json({ error: "ユデートが見つかりません" });
    return;
  }

  // 管理者アカウント @Yudetter を検索、なければ作成
  let [admin] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.username, "Yudetter"))
    .limit(1);

  if (!admin) {
    const [inserted] = await db
      .insert(usersTable)
      .values({
        username: "Yudetter",
        displayName: "Yudetter公式",
        name: "Yudetter Admin",
        email: "admin@yudetter.internal",
        setupComplete: true,
        isVerified: true,
      })
      .returning();
    admin = inserted;
  } else if (!admin.isVerified) {
    await db
      .update(usersTable)
      .set({ isVerified: true, updatedAt: new Date() })
      .where(eq(usersTable.id, admin.id));
    admin.isVerified = true;
  }

  // 通知を送信
  await db.insert(notificationsTable).values({
    userId: admin.id,
    type: "report",
    actorId: req.dbUserId!,
    yudateId: id,
  });

  res.json({ success: true });
});

export default router;
