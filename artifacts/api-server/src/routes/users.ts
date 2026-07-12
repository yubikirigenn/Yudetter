import { Router } from "express";
import { eq, desc, and, isNull, or, lte, gt } from "drizzle-orm";
import { db, usersTable, yudatesTable, likesTable, followsTable, notificationsTable, blocksTable } from "@workspace/db";
import {
  UpdateMeBody,
} from "@workspace/api-zod";
import { requireAuth, optionalAuth } from "../lib/auth";
import { buildUserProfile, buildYudatePage } from "../lib/buildResponse";
import { sseManager } from "../lib/sse";
import { checkAndApplyLoginBonus, checkAndApplyRankingRewards } from "../lib/yudedollar";

const router = Router();

// POST /users/lookup-email - ユーザーID(@ID)からメールアドレスを返す（ログイン補助用）
router.post("/users/lookup-email", async (req, res): Promise<void> => {
  const { username } = req.body as { username?: string };
  if (!username) {
    res.status(400).json({ error: "usernameが必要です" });
    return;
  }
  const clean = username.trim().toLowerCase().replace(/^@/, "");
  const [user] = await db
    .select({ email: usersTable.email })
    .from(usersTable)
    .where(eq(usersTable.username, clean))
    .limit(1);
  if (!user) {
    res.status(404).json({ error: "そのユーザーIDは存在しません" });
    return;
  }
  res.json({ email: user.email });
});

// GET /users/me
router.get("/users/me", requireAuth, async (req, res): Promise<void> => {
  try {
    // 非同期でランキング解決をトリガー (レスポンス遅延を防ぐため)
    checkAndApplyRankingRewards().catch((e) =>
      console.error("Ranking rewards processing error", e)
    );

    // ログインボーナスのチェックと適用
    await checkAndApplyLoginBonus(req.dbUserId!);
  } catch (e) {
    console.error("Failed to process login bonus or ranking check", e);
  }

  const profile = await buildUserProfile(req.dbUserId!, req.dbUserId);
  if (!profile) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json(profile);
});

// PATCH /users/me
router.patch("/users/me", requireAuth, async (req, res): Promise<void> => {
  const parsed = UpdateMeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updates: Record<string, unknown> = {};
  if (parsed.data.displayName !== undefined) updates.displayName = parsed.data.displayName;
  if (parsed.data.bio !== undefined) updates.bio = parsed.data.bio;
  if (parsed.data.avatarUrl !== undefined) {
    updates.avatarUrl = parsed.data.avatarUrl;
    updates.image = parsed.data.avatarUrl; // Better Auth session image sync
  }
  if (parsed.data.headerUrl !== undefined) updates.headerUrl = parsed.data.headerUrl;
  if (parsed.data.isPrivate !== undefined) updates.isPrivate = parsed.data.isPrivate;

  if (parsed.data.username !== undefined && parsed.data.username !== null) {
    const cleanUsername = parsed.data.username.trim().toLowerCase();
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(cleanUsername)) {
      res.status(400).json({ error: "ユーザー名は3〜20文字の半角英数字とアンダースコアのみ使用できます。" });
      return;
    }

    const [existing] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.username, cleanUsername))
      .limit(1);

    if (existing && existing.id !== req.dbUserId) {
      res.status(400).json({ error: "このユーザー名は既に他のユーザーに使用されています。" });
      return;
    }
    updates.username = cleanUsername;
  }

  await db.update(usersTable).set(updates).where(eq(usersTable.id, req.dbUserId!));
  const profile = await buildUserProfile(req.dbUserId!, req.dbUserId);
  res.json(profile);
});


// GET /users/:username
router.get("/users/:username", optionalAuth, async (req, res): Promise<void> => {
  const username = Array.isArray(req.params.username) ? req.params.username[0] : req.params.username;

  const [user] = await db.select().from(usersTable).where(eq(usersTable.username, username)).limit(1);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const profile = await buildUserProfile(user.id, req.dbUserId);
  res.json(profile);
});

// GET /users/:username/yudates
router.get("/users/:username/yudates", optionalAuth, async (req, res): Promise<void> => {
  const username = Array.isArray(req.params.username) ? req.params.username[0] : req.params.username;

  const [user] = await db.select({ id: usersTable.id, pinnedYudateId: usersTable.pinnedYudateId }).from(usersTable).where(eq(usersTable.username, username)).limit(1);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const now = new Date();
  
  let conditions = [
    eq(yudatesTable.authorId, user.id),
    isNull(yudatesTable.replyToId)
  ];
  
  if (req.dbUserId !== user.id) {
    conditions.push(or(isNull(yudatesTable.scheduledFor), lte(yudatesTable.scheduledFor, now)));
    conditions.push(or(isNull(yudatesTable.autoDeleteAt), gt(yudatesTable.autoDeleteAt, now)));
    
    let canView = true;
    
    // ブロック判定
    if (req.dbUserId) {
      const [block] = await db.select().from(blocksTable)
        .where(
          or(
            and(eq(blocksTable.blockerId, req.dbUserId), eq(blocksTable.blockedId, user.id)),
            and(eq(blocksTable.blockerId, user.id), eq(blocksTable.blockedId, req.dbUserId))
          )
        ).limit(1);
      if (block) {
        canView = false;
      }
    }

    if (user.isPrivate) {
      if (!req.dbUserId) {
        canView = false;
      } else {
        const [f] = await db.select().from(followsTable)
          .where(and(eq(followsTable.followerId, req.dbUserId), eq(followsTable.followingId, user.id)));
        if (!f || f.status !== "accepted") {
          canView = false;
        }
      }
    }
    
    if (!canView) {
      res.json({ items: [], nextCursor: null });
      return;
    }
    
    // visibility: followers も考慮（鍵垢でなくても、フォロワー限定投稿はフォローしていないと見れない）
    if (!req.dbUserId) {
      conditions.push(eq(yudatesTable.visibility, "public"));
    } else {
      const [f] = await db.select().from(followsTable)
        .where(and(eq(followsTable.followerId, req.dbUserId), eq(followsTable.followingId, user.id)));
      if (!f || f.status !== "accepted") {
         conditions.push(eq(yudatesTable.visibility, "public"));
      }
    }
  }

  const rows = await db
    .select({ id: yudatesTable.id })
    .from(yudatesTable)
    // @ts-ignore
    .where(and(...conditions))
    .orderBy(desc(yudatesTable.id))
    .limit(50);

  const page = await buildYudatePage(rows.map((r) => r.id), req.dbUserId, null);
  res.json(page);
});

// GET /users/:username/likes
router.get("/users/:username/likes", optionalAuth, async (req, res): Promise<void> => {
  const username = Array.isArray(req.params.username) ? req.params.username[0] : req.params.username;

  const [user] = await db.select({ id: usersTable.id, isPrivate: usersTable.isPrivate }).from(usersTable).where(eq(usersTable.username, username)).limit(1);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  let canView = true;
  if (req.dbUserId !== user.id) {
    // ブロック判定
    if (req.dbUserId) {
      const [block] = await db.select().from(blocksTable)
        .where(
          or(
            and(eq(blocksTable.blockerId, req.dbUserId), eq(blocksTable.blockedId, user.id)),
            and(eq(blocksTable.blockerId, user.id), eq(blocksTable.blockedId, req.dbUserId))
          )
        ).limit(1);
      if (block) {
        canView = false;
      }
    }
    
    // 非公開アカウント判定
    if (user.isPrivate) {
      if (!req.dbUserId) {
        canView = false;
      } else {
        const [f] = await db.select().from(followsTable)
          .where(and(eq(followsTable.followerId, req.dbUserId), eq(followsTable.followingId, user.id)));
        if (!f || f.status !== "accepted") {
          canView = false;
        }
      }
    }
  }

  if (!canView) {
    res.json({ items: [], nextCursor: null });
    return;
  }

  const likedRows = await db
    .select({ yudateId: likesTable.yudateId })
    .from(likesTable)
    .where(eq(likesTable.userId, user.id))
    .orderBy(desc(likesTable.createdAt))
    .limit(50);

  const page = await buildYudatePage(likedRows.map((r) => r.yudateId), req.dbUserId, null);
  res.json(page);
});

// POST /users/:username/follow
router.post("/users/:username/follow", requireAuth, async (req, res): Promise<void> => {
  const username = Array.isArray(req.params.username) ? req.params.username[0] : req.params.username;

  const [target] = await db
    .select({ id: usersTable.id, isPrivate: usersTable.isPrivate })
    .from(usersTable)
    .where(eq(usersTable.username, username))
    .limit(1);
  if (!target) { res.status(404).json({ error: "User not found" }); return; }
  if (target.id === req.dbUserId) { res.status(400).json({ error: "Cannot follow yourself" }); return; }

  try {
    const isPending = target.isPrivate;
    const followStatus = isPending ? "pending" : "accepted";
    const actionMessage = isPending ? "があなたにフォローリクエストを送信しました" : "があなたをフォローしました";

    await db.insert(followsTable).values({
      followerId: req.dbUserId!,
      followingId: target.id,
      status: followStatus,
    });

    await db.insert(notificationsTable).values({
      userId: target.id,
      type: "follow",
      actorId: req.dbUserId!,
    }).onConflictDoNothing();

    sseManager.notifyUser(target.id, {
      type: "follow",
      actorName: req.user?.displayName || req.user?.name || "誰か",
      actionMessage,
    });
  } catch {
    // already following or request pending
  }
  res.json({ success: true });
});


// GET /users/me/follow-requests
router.get("/users/me/follow-requests", requireAuth, async (req, res): Promise<void> => {
  const requests = await db
    .select({ followerId: followsTable.followerId })
    .from(followsTable)
    .where(and(eq(followsTable.followingId, req.dbUserId), eq(followsTable.status, "pending")));
  
  const profiles = await Promise.all(
    requests.map(r => buildUserProfile(r.followerId, req.dbUserId))
  );
  
  res.json(profiles);
});

// POST /users/:username/follow/approve
router.post("/users/:username/follow/approve", requireAuth, async (req, res): Promise<void> => {
  const username = Array.isArray(req.params.username) ? req.params.username[0] : req.params.username;
  const [targetUser] = await db.select().from(usersTable).where(eq(usersTable.username, username)).limit(1);
  if (!targetUser) { res.status(404).json({ error: "User not found" }); return; }

  await db.update(followsTable)
    .set({ status: "accepted" })
    .where(and(eq(followsTable.followerId, targetUser.id), eq(followsTable.followingId, req.dbUserId)));
    
  res.json({ success: true });
});

// POST /users/:username/follow/reject
router.post("/users/:username/follow/reject", requireAuth, async (req, res): Promise<void> => {
  const username = Array.isArray(req.params.username) ? req.params.username[0] : req.params.username;
  const [targetUser] = await db.select().from(usersTable).where(eq(usersTable.username, username)).limit(1);
  if (!targetUser) { res.status(404).json({ error: "User not found" }); return; }

  await db.delete(followsTable)
    .where(and(eq(followsTable.followerId, targetUser.id), eq(followsTable.followingId, req.dbUserId)));
    
  res.json({ success: true });
});

// DELETE /users/:username/follow
router.delete("/users/:username/follow", requireAuth, async (req, res): Promise<void> => {
  const username = Array.isArray(req.params.username) ? req.params.username[0] : req.params.username;

  const [target] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.username, username)).limit(1);
  if (!target) { res.status(404).json({ error: "User not found" }); return; }

  await db.delete(followsTable).where(
    and(eq(followsTable.followerId, req.dbUserId!), eq(followsTable.followingId, target.id)),
  );

  // Remove the follow notification
  await db.delete(notificationsTable).where(
    and(
      eq(notificationsTable.userId, target.id),
      eq(notificationsTable.type, "follow"),
      eq(notificationsTable.actorId, req.dbUserId!)
    )
  );

  res.json({ success: true });
});

// GET /users/:username/followers
router.get("/users/:username/followers", optionalAuth, async (req, res): Promise<void> => {
  const username = Array.isArray(req.params.username) ? req.params.username[0] : req.params.username;

  const [user] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.username, username)).limit(1);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const followers = await db
    .select({ id: followsTable.followerId })
    .from(followsTable)
    .where(eq(followsTable.followingId, user.id))
    .limit(50);

  const profiles = (
    await Promise.all(followers.map((f) => buildUserProfile(f.id, req.dbUserId)))
  ).filter(Boolean);

  res.json({ items: profiles, nextCursor: null });
});

// GET /users/:username/following
router.get("/users/:username/following", optionalAuth, async (req, res): Promise<void> => {
  const username = Array.isArray(req.params.username) ? req.params.username[0] : req.params.username;

  const [user] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.username, username)).limit(1);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const following = await db
    .select({ id: followsTable.followingId })
    .from(followsTable)
    .where(eq(followsTable.followerId, user.id))
    .limit(50);

  const profiles = (
    await Promise.all(following.map((f) => buildUserProfile(f.id, req.dbUserId)))
  ).filter(Boolean);

  res.json({ items: profiles, nextCursor: null });
});

// POST /users/:username/block
router.post("/users/:username/block", requireAuth, async (req, res): Promise<void> => {
  const username = Array.isArray(req.params.username) ? req.params.username[0] : req.params.username;

  const [target] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.username, username)).limit(1);
  if (!target) { res.status(404).json({ error: "User not found" }); return; }
  if (target.id === req.dbUserId) { res.status(400).json({ error: "Cannot block yourself" }); return; }

  try {
    // ブロック実行
    await db.insert(blocksTable).values({ blockerId: req.dbUserId!, blockedId: target.id }).onConflictDoNothing();
    
    // お互いのフォロー関係を解除
    await db.delete(followsTable).where(
      or(
        and(eq(followsTable.followerId, req.dbUserId!), eq(followsTable.followingId, target.id)),
        and(eq(followsTable.followerId, target.id), eq(followsTable.followingId, req.dbUserId!))
      )
    );
  } catch (error) {
    console.error(error);
  }
  res.json({ success: true });
});

// DELETE /users/:username/block
router.delete("/users/:username/block", requireAuth, async (req, res): Promise<void> => {
  const username = Array.isArray(req.params.username) ? req.params.username[0] : req.params.username;

  const [target] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.username, username)).limit(1);
  if (!target) { res.status(404).json({ error: "User not found" }); return; }

  await db.delete(blocksTable).where(
    and(eq(blocksTable.blockerId, req.dbUserId!), eq(blocksTable.blockedId, target.id)),
  );

  res.json({ success: true });
});

// GET /users/me/blocks
router.get("/users/me/blocks", requireAuth, async (req, res): Promise<void> => {
  const blocked = await db
    .select({ id: blocksTable.blockedId })
    .from(blocksTable)
    .where(eq(blocksTable.blockerId, req.dbUserId!))
    .limit(50);

  const profiles = (
    await Promise.all(blocked.map((b) => buildUserProfile(b.id, req.dbUserId)))
  ).filter(Boolean);

  res.json({ items: profiles, nextCursor: null });
});

// DELETE /users/me - アカウント削除 (退会)
router.delete("/users/me", requireAuth, async (req, res): Promise<void> => {
  try {
    const userId = req.dbUserId!;
    await db.delete(usersTable).where(eq(usersTable.id, userId));
    res.json({ success: true });
  } catch (e) {
    console.error("Failed to delete account", e);
    res.status(500).json({ error: "アカウントの削除に失敗しました" });
  }
});

export default router;
