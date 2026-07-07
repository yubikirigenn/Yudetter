import { Router } from "express";
import { eq, desc, and } from "drizzle-orm";
import { db, usersTable, yudatesTable, likesTable, followsTable, notificationsTable } from "@workspace/db";
import {
  UpdateMeBody,
  SyncUserBody,
} from "@workspace/api-zod";
import { requireAuth, optionalAuth } from "../lib/auth";
import { buildUserProfile, buildYudatePage } from "../lib/buildResponse";

const router = Router();

// GET /users/me
router.get("/users/me", requireAuth, async (req, res): Promise<void> => {
  const profile = await buildUserProfile(req.dbUserId!, req.dbUserId);
  if (!profile) { res.status(404).json({ error: "User not found" }); return; }
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
  if (parsed.data.avatarUrl !== undefined) updates.avatarUrl = parsed.data.avatarUrl;

  await db.update(usersTable).set(updates).where(eq(usersTable.id, req.dbUserId!));
  const profile = await buildUserProfile(req.dbUserId!, req.dbUserId);
  res.json(profile);
});

// POST /users/sync - JIT provision (auth required; clerkId derived from session, not body)
router.post("/users/sync", async (req, res): Promise<void> => {
  const { getAuth } = await import("@clerk/express");
  const auth = getAuth(req);
  const verifiedClerkId = auth?.userId;

  if (!verifiedClerkId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const parsed = SyncUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  // Ignore any clerkId in the body — always use the verified session subject
  const { username, displayName, email, avatarUrl } = parsed.data;
  const clerkId = verifiedClerkId;

  // Upsert by clerkId
  const existing = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.clerkId, clerkId))
    .limit(1);

  let userId: number;
  if (existing.length > 0) {
    await db
      .update(usersTable)
      .set({ displayName, avatarUrl: avatarUrl ?? null })
      .where(eq(usersTable.clerkId, clerkId));
    userId = existing[0].id;
  } else {
    // Ensure username uniqueness
    let finalUsername = username;
    const usernameExists = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.username, username)).limit(1);
    if (usernameExists.length > 0) {
      finalUsername = `${username}_${Date.now().toString(36)}`;
    }

    const [created] = await db
      .insert(usersTable)
      .values({ clerkId, username: finalUsername, displayName, email, avatarUrl: avatarUrl ?? null })
      .returning({ id: usersTable.id });
    userId = created.id;
  }

  const profile = await buildUserProfile(userId, userId);
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

  const [user] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.username, username)).limit(1);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const rows = await db
    .select({ id: yudatesTable.id })
    .from(yudatesTable)
    .where(eq(yudatesTable.authorId, user.id))
    .orderBy(desc(yudatesTable.id))
    .limit(50);

  const page = await buildYudatePage(rows.map((r) => r.id), req.dbUserId, null);
  res.json(page);
});

// GET /users/:username/likes
router.get("/users/:username/likes", optionalAuth, async (req, res): Promise<void> => {
  const username = Array.isArray(req.params.username) ? req.params.username[0] : req.params.username;

  const [user] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.username, username)).limit(1);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

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

  const [target] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.username, username)).limit(1);
  if (!target) { res.status(404).json({ error: "User not found" }); return; }
  if (target.id === req.dbUserId) { res.status(400).json({ error: "Cannot follow yourself" }); return; }

  try {
    await db.insert(followsTable).values({ followerId: req.dbUserId!, followingId: target.id });
    await db.insert(notificationsTable).values({
      userId: target.id,
      type: "follow",
      actorId: req.dbUserId!,
    }).onConflictDoNothing();
  } catch {
    // already following
  }
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

export default router;
