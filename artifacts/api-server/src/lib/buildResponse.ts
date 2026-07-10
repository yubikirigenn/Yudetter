import { db, usersTable, yudatesTable, likesTable, reyudatesTable, followsTable, reactionsTable, blocksTable } from "@workspace/db";
import { eq, sql, and, inArray } from "drizzle-orm";

export type UserProfileShape = {
  id: number;
  clerkId: string;
  username: string;
  displayName: string;
  email: string;
  bio: string | null;
  avatarUrl: string | null;
  headerUrl: string | null;
  birthday: string | null;
  setupComplete: boolean;
  followerCount: number;
  followingCount: number;
  yudateCount: number;
  isFollowing: boolean;
  isFollowPending: boolean;
  isPrivate: boolean;
  isBlocking: boolean;
  isBlockedBy: boolean;
  pinnedYudateId: number | null;
  yudedollar: number;
  badgeType: string | null;
  consecutiveLoginDays: number;
  rankingOptIn: boolean;
  createdAt: string;
};

export type ReactionShape = {
  emoji: string;
  count: number;
  isReacted: boolean;
};

export type YudateShape = {
  id: number;
  content: string;
  imageUrl: string | null;
  author: UserProfileShape;
  likeCount: number;
  reyudateCount: number;
  replyCount: number;
  isLiked: boolean;
  isReyudated: boolean;
  isSpoiler: boolean;
  reactions: ReactionShape[];
  quotedYudate: QuotedYudateShape | null;
  replyToId: number | null;
  superYudateAmount: number;
  createdAt: string;
};

export type QuotedYudateShape = {
  id: number;
  content: string;
  imageUrl: string | null;
  author: UserProfileShape;
  createdAt: string;
};

export async function buildUserProfile(
  userId: number,
  viewerUserId?: number,
): Promise<UserProfileShape | null> {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user) return null;

  const [[followerResult], [followingResult], [yudateCountResult], followCheck, blockingCheck, blockedByCheck] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` }).from(followsTable).where(eq(followsTable.followingId, userId)),
    db.select({ count: sql<number>`count(*)::int` }).from(followsTable).where(eq(followsTable.followerId, userId)),
    db.select({ count: sql<number>`count(*)::int` }).from(yudatesTable).where(eq(yudatesTable.authorId, userId)),
    viewerUserId && viewerUserId !== userId
      ? db.select().from(followsTable).where(and(eq(followsTable.followerId, viewerUserId), eq(followsTable.followingId, userId))).limit(1)
      : Promise.resolve([]),
    viewerUserId && viewerUserId !== userId
      ? db.select().from(blocksTable).where(and(eq(blocksTable.blockerId, viewerUserId), eq(blocksTable.blockedId, userId))).limit(1)
      : Promise.resolve([]),
    viewerUserId && viewerUserId !== userId
      ? db.select().from(blocksTable).where(and(eq(blocksTable.blockerId, userId), eq(blocksTable.blockedId, viewerUserId))).limit(1)
      : Promise.resolve([]),
  ]);

  return {
    id: user.id,
    clerkId: user.clerkId || "",
    username: user.username,
    displayName: user.displayName,
    email: user.email,
    bio: user.bio,
    avatarUrl: user.avatarUrl || user.image || null,
    headerUrl: user.headerUrl ?? null,
    birthday: user.birthday ?? null,
    setupComplete: user.setupComplete,
    followerCount: followerResult?.count ?? 0,
    followingCount: followingResult?.count ?? 0,
    yudateCount: yudateCountResult?.count ?? 0,
    isFollowing: Array.isArray(followCheck) && followCheck.length > 0,
    isPrivate: user.isPrivate ?? false,
    isBlocking: Array.isArray(blockingCheck) && blockingCheck.length > 0,
    isBlockedBy: Array.isArray(blockedByCheck) && blockedByCheck.length > 0,
    pinnedYudateId: user.pinnedYudateId ?? null,
    yudedollar: user.yudedollar ?? 0,
    badgeType: user.badgeType ?? null,
    consecutiveLoginDays: user.consecutiveLoginDays ?? 0,
    rankingOptIn: user.rankingOptIn ?? false,
    createdAt: user.createdAt.toISOString(),
  };
}

async function buildReactions(yudateId: number, viewerUserId?: number): Promise<ReactionShape[]> {
  const rows = await db
    .select({ emoji: reactionsTable.emoji, userId: reactionsTable.userId })
    .from(reactionsTable)
    .where(eq(reactionsTable.yudateId, yudateId));

  const grouped: Record<string, { count: number; isReacted: boolean }> = {};
  for (const row of rows) {
    if (!grouped[row.emoji]) grouped[row.emoji] = { count: 0, isReacted: false };
    grouped[row.emoji].count += 1;
    if (viewerUserId && row.userId === viewerUserId) {
      grouped[row.emoji].isReacted = true;
    }
  }

  return Object.entries(grouped).map(([emoji, data]) => ({
    emoji,
    count: data.count,
    isReacted: data.isReacted,
  }));
}

export async function buildYudate(
  yudateId: number,
  viewerUserId?: number,
): Promise<YudateShape | null> {
  const [yudate] = await db.select().from(yudatesTable).where(eq(yudatesTable.id, yudateId)).limit(1);
  if (!yudate) return null;

  const [author, [likeResult], [reyudateResult], [replyCountResult], likeCheck, reyudateCheck, reactions] = await Promise.all([
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
    buildReactions(yudateId, viewerUserId),
  ]);

  if (!author) return null;

  let quotedYudate: QuotedYudateShape | null = null;
  if (yudate.quotedYudateId) {
    const [qy] = await db.select().from(yudatesTable).where(eq(yudatesTable.id, yudate.quotedYudateId)).limit(1);
    if (qy) {
      const qAuthor = await buildUserProfile(qy.authorId, viewerUserId);
      if (qAuthor) {
        quotedYudate = {
          id: qy.id,
          content: qy.content,
          imageUrl: qy.imageUrl ?? null,
          author: qAuthor,
          createdAt: qy.createdAt.toISOString(),
        };
      }
    }
  }

  return {
    id: yudate.id,
    content: yudate.content,
    imageUrl: yudate.imageUrl ?? null,
    author,
    likeCount: likeResult?.count ?? 0,
    reyudateCount: reyudateResult?.count ?? 0,
    replyCount: replyCountResult?.count ?? 0,
    isLiked: Array.isArray(likeCheck) && likeCheck.length > 0,
    isReyudated: Array.isArray(reyudateCheck) && reyudateCheck.length > 0,
    isSpoiler: yudate.isSpoiler ?? false,
    reactions,
    quotedYudate,
    replyToId: yudate.replyToId,
    superYudateAmount: yudate.superYudateAmount ?? 0,
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
