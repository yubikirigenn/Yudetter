import { db, usersTable, yudatesTable, likesTable, reyudatesTable, followsTable } from "@workspace/db";
import { eq, sql, and, inArray } from "drizzle-orm";

export type UserProfileShape = {
  id: number;
  clerkId: string;
  username: string;
  displayName: string;
  email: string;
  bio: string | null;
  avatarUrl: string | null;
  birthday: string | null;
  setupComplete: boolean;
  followerCount: number;
  followingCount: number;
  yudateCount: number;
  isFollowing: boolean;
  createdAt: string;
};

export type YudateShape = {
  id: number;
  content: string;
  author: UserProfileShape;
  likeCount: number;
  reyudateCount: number;
  replyCount: number;
  isLiked: boolean;
  isReyudated: boolean;
  quotedYudate: QuotedYudateShape | null;
  replyToId: number | null;
  createdAt: string;
};

export type QuotedYudateShape = {
  id: number;
  content: string;
  author: UserProfileShape;
  createdAt: string;
};

export async function buildUserProfile(
  userId: number,
  viewerUserId?: number,
): Promise<UserProfileShape | null> {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user) return null;

  const [[followerResult], [followingResult], [yudateCountResult], followCheck] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` }).from(followsTable).where(eq(followsTable.followingId, userId)),
    db.select({ count: sql<number>`count(*)::int` }).from(followsTable).where(eq(followsTable.followerId, userId)),
    db.select({ count: sql<number>`count(*)::int` }).from(yudatesTable).where(eq(yudatesTable.authorId, userId)),
    viewerUserId && viewerUserId !== userId
      ? db.select().from(followsTable).where(and(eq(followsTable.followerId, viewerUserId), eq(followsTable.followingId, userId))).limit(1)
      : Promise.resolve([]),
  ]);

  return {
    id: user.id,
    clerkId: user.clerkId,
    username: user.username,
    displayName: user.displayName,
    email: user.email,
    bio: user.bio,
    avatarUrl: user.avatarUrl,
    birthday: user.birthday ?? null,
    setupComplete: user.setupComplete,
    followerCount: followerResult?.count ?? 0,
    followingCount: followingResult?.count ?? 0,
    yudateCount: yudateCountResult?.count ?? 0,
    isFollowing: Array.isArray(followCheck) && followCheck.length > 0,
    createdAt: user.createdAt.toISOString(),
  };
}

export async function buildYudate(
  yudateId: number,
  viewerUserId?: number,
): Promise<YudateShape | null> {
  const [yudate] = await db.select().from(yudatesTable).where(eq(yudatesTable.id, yudateId)).limit(1);
  if (!yudate) return null;

  const [author, [likeResult], [reyudateResult], [replyCountResult], likeCheck, reyudateCheck] = await Promise.all([
    buildUserProfile(yudate.authorId, viewerUserId),
    db.select({ count: sql<number>`count(*)::int` }).from(likesTable).where(eq(likesTable.yudateId, yudateId)),
    db.select({ count: sql<number>`count(*)::int` }).from(reyudatesTable).where(eq(reyudatesTable.originalYudateId, yudateId)),
    db.select({ count: sql<number>`count(*)::int` }).from(yudatesTable).where(eq(yudatesTable.replyToId, yudateId)),
    viewerUserId
      ? db.select().from(likesTable).where(and(eq(likesTable.userId, viewerUserId), eq(likesTable.yudateId, yudateId))).limit(1)
      : Promise.resolve([]),
    viewerUserId
      ? db.select().from(reyudatesTable).where(and(eq(reyudatesTable.userId, viewerUserId), eq(reyudatesTable.originalYudateId, yudateId))).limit(1)
      : Promise.resolve([]),
  ]);

  if (!author) return null;

  let quotedYudate: QuotedYudateShape | null = null;
  if (yudate.quotedYudateId) {
    const [qy] = await db.select().from(yudatesTable).where(eq(yudatesTable.id, yudate.quotedYudateId)).limit(1);
    if (qy) {
      const qAuthor = await buildUserProfile(qy.authorId, viewerUserId);
      if (qAuthor) {
        quotedYudate = { id: qy.id, content: qy.content, author: qAuthor, createdAt: qy.createdAt.toISOString() };
      }
    }
  }

  return {
    id: yudate.id,
    content: yudate.content,
    author,
    likeCount: likeResult?.count ?? 0,
    reyudateCount: reyudateResult?.count ?? 0,
    replyCount: replyCountResult?.count ?? 0,
    isLiked: Array.isArray(likeCheck) && likeCheck.length > 0,
    isReyudated: Array.isArray(reyudateCheck) && reyudateCheck.length > 0,
    quotedYudate,
    replyToId: yudate.replyToId,
    createdAt: yudate.createdAt.toISOString(),
  };
}

export async function buildYudatePage(
  yudateIds: number[],
  viewerUserId?: number,
  nextCursor?: number | null,
): Promise<{ items: YudateShape[]; nextCursor: number | null }> {
  const items = (
    await Promise.all(yudateIds.map((id) => buildYudate(id, viewerUserId)))
  ).filter((y): y is YudateShape => y !== null);

  return { items, nextCursor: nextCursor ?? null };
}
