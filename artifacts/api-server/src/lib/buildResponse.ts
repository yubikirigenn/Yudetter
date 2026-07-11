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
  isVerified: boolean;
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
  superYudateAmount: number;
  createdAt: string;
};

export async function buildUserProfile(
  userId: number,
  viewerUserId?: number,
): Promise<UserProfileShape | null> {
  const result = await buildUserProfilesBulk([userId], viewerUserId);
  return result.get(userId) || null;
}

// Bulk high-performance profile fetcher to solve N+1 query issue
export async function buildUserProfilesBulk(
  userIds: number[],
  viewerUserId?: number,
  isMinimal: boolean = false,
): Promise<Map<number, UserProfileShape>> {
  const result = new Map<number, UserProfileShape>();
  if (userIds.length === 0) return result;

  const uniqueIds = Array.from(new Set(userIds));
  const users = await db.select().from(usersTable).where(inArray(usersTable.id, uniqueIds));

  const [followerCounts, followingCounts, yudateCounts, followChecks, blockingChecks, blockedByChecks] = await Promise.all([
    isMinimal
      ? Promise.resolve([])
      : db.select({ followingId: followsTable.followingId, count: sql<number>`count(*)::int` })
          .from(followsTable).where(inArray(followsTable.followingId, uniqueIds)).groupBy(followsTable.followingId),
    isMinimal
      ? Promise.resolve([])
      : db.select({ followerId: followsTable.followerId, count: sql<number>`count(*)::int` })
          .from(followsTable).where(inArray(followsTable.followerId, uniqueIds)).groupBy(followsTable.followerId),
    isMinimal
      ? Promise.resolve([])
      : db.select({ authorId: yudatesTable.authorId, count: sql<number>`count(*)::int` })
          .from(yudatesTable).where(inArray(yudatesTable.authorId, uniqueIds)).groupBy(yudatesTable.authorId),
    viewerUserId
      ? db.select().from(followsTable).where(and(eq(followsTable.followerId, viewerUserId), inArray(followsTable.followingId, uniqueIds)))
      : Promise.resolve([]),
    viewerUserId
      ? db.select().from(blocksTable).where(and(eq(blocksTable.blockerId, viewerUserId), inArray(blocksTable.blockedId, uniqueIds)))
      : Promise.resolve([]),
    viewerUserId
      ? db.select().from(blocksTable).where(and(inArray(blocksTable.blockerId, uniqueIds), eq(blocksTable.blockedId, viewerUserId)))
      : Promise.resolve([]),
  ]);

  const followerMap = new Map(followerCounts.map(c => [c.followingId, c.count]));
  const followingMap = new Map(followingCounts.map(c => [c.followerId, c.count]));
  const yudateCountMap = new Map(yudateCounts.map(c => [c.authorId, c.count]));

  const followCheckSet = new Set(followChecks.map(f => f.followingId));
  const blockingCheckSet = new Set(blockingChecks.map(b => b.blockedId));
  const blockedByCheckSet = new Set(blockedByChecks.map(b => b.blockerId));

  for (const user of users) {
    result.set(user.id, {
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
      followerCount: followerMap.get(user.id) ?? 0,
      followingCount: followingMap.get(user.id) ?? 0,
      yudateCount: yudateCountMap.get(user.id) ?? 0,
      isFollowing: followCheckSet.has(user.id),
      isFollowPending: false,
      isPrivate: user.isPrivate ?? false,
      isBlocking: blockingCheckSet.has(user.id),
      isBlockedBy: blockedByCheckSet.has(user.id),
      pinnedYudateId: user.pinnedYudateId ?? null,
      yudedollar: user.yudedollar ?? 0,
       badgeType: user.badgeType ?? null,
      isVerified: user.isVerified ?? false,
      consecutiveLoginDays: user.consecutiveLoginDays ?? 0,
      rankingOptIn: user.rankingOptIn ?? false,
      createdAt: user.createdAt.toISOString(),
    });
  }

  return result;
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
  const pageResult = await buildYudatePage([yudateId], viewerUserId, null);
  return pageResult.items[0] || null;
}

// Optimized bulk response page builder to completely eliminate N+1 queries
export async function buildYudatePage(
  yudateIds: number[],
  viewerUserId?: number,
  nextCursor?: number | null,
): Promise<{ items: YudateShape[]; nextCursor: number | null }> {
  if (yudateIds.length === 0) {
    return { items: [], nextCursor: nextCursor ?? null };
  }

  // 1. Fetch Yudates in bulk
  const yudates = await db.select().from(yudatesTable).where(inArray(yudatesTable.id, yudateIds));
  const yudateMap = new Map(yudates.map(y => [y.id, y]));

  // Quoted yudates collection
  const quotedIds = yudates.map(y => y.quotedYudateId).filter((id): id is number => id !== null);
  let quotedMap = new Map<number, typeof yudatesTable.$inferSelect>();
  if (quotedIds.length > 0) {
    const qys = await db.select().from(yudatesTable).where(inArray(yudatesTable.id, quotedIds));
    quotedMap = new Map(qys.map(qy => [qy.id, qy]));
  }

  // Gather all author IDs to bulk-fetch user profiles
  const allAuthorIds = [
    ...yudates.map(y => y.authorId),
    ...Array.from(quotedMap.values()).map(qy => qy.authorId)
  ];
  const userProfileMap = await buildUserProfilesBulk(allAuthorIds, viewerUserId, true);

  // 2. Fetch all metadata (likes, reyudates, replies, reactions) in bulk
  const [likeCounts, reyudateCounts, replyCounts, userLikes, userReyudates, allReactions] = await Promise.all([
    db.select({ yudateId: likesTable.yudateId, count: sql<number>`count(*)::int` })
      .from(likesTable).where(inArray(likesTable.yudateId, yudateIds)).groupBy(likesTable.yudateId),
    db.select({ originalYudateId: reyudatesTable.originalYudateId, count: sql<number>`count(*)::int` })
      .from(reyudatesTable).where(inArray(reyudatesTable.originalYudateId, yudateIds)).groupBy(reyudatesTable.originalYudateId),
    db.select({ replyToId: yudatesTable.replyToId, count: sql<number>`count(*)::int` })
      .from(yudatesTable).where(inArray(yudatesTable.replyToId, yudateIds)).groupBy(yudatesTable.replyToId),
    viewerUserId
      ? db.select().from(likesTable).where(and(eq(likesTable.userId, viewerUserId), inArray(likesTable.yudateId, yudateIds)))
      : Promise.resolve([]),
    viewerUserId
      ? db.select().from(reyudatesTable).where(and(eq(reyudatesTable.userId, viewerUserId), inArray(reyudatesTable.originalYudateId, yudateIds)))
      : Promise.resolve([]),
    db.select().from(reactionsTable).where(inArray(reactionsTable.yudateId, yudateIds)),
  ]);

  const likeCountMap = new Map(likeCounts.map(c => [c.yudateId, c.count]));
  const reyudateCountMap = new Map(reyudateCounts.map(c => [c.originalYudateId, c.count]));
  const replyCountMap = new Map(replyCounts.map(c => [c.replyToId!, c.count]));

  const userLikeSet = new Set(userLikes.map(l => l.yudateId));
  const userReyudateSet = new Set(userReyudates.map(r => r.originalYudateId));

  // Map reactions by yudate ID
  const reactionsMap = new Map<number, ReactionShape[]>();
  const reactionsGrouped = new Map<number, typeof reactionsTable.$inferSelect[]>();
  for (const r of allReactions) {
    if (!reactionsGrouped.has(r.yudateId)) {
      reactionsGrouped.set(r.yudateId, []);
    }
    reactionsGrouped.get(r.yudateId)!.push(r);
  }

  for (const [yId, rows] of reactionsGrouped.entries()) {
    const grouped: Record<string, { count: number; isReacted: boolean }> = {};
    for (const row of rows) {
      if (!grouped[row.emoji]) grouped[row.emoji] = { count: 0, isReacted: false };
      grouped[row.emoji].count += 1;
      if (viewerUserId && row.userId === viewerUserId) {
        grouped[row.emoji].isReacted = true;
      }
    }
    reactionsMap.set(yId, Object.entries(grouped).map(([emoji, d]) => ({
      emoji,
      count: d.count,
      isReacted: d.isReacted,
    })));
  }

  // Construct items in preservation of original yudateIds ordering
  const items: YudateShape[] = [];
  for (const id of yudateIds) {
    const yudate = yudateMap.get(id);
    if (!yudate) continue;

    const author = userProfileMap.get(yudate.authorId);
    if (!author) continue;

    let quotedYudate: QuotedYudateShape | null = null;
    if (yudate.quotedYudateId) {
      const qy = quotedMap.get(yudate.quotedYudateId);
      if (qy) {
        const qAuthor = userProfileMap.get(qy.authorId);
        if (qAuthor) {
          quotedYudate = {
            id: qy.id,
            content: qy.content,
            imageUrl: qy.imageUrl ?? null,
            author: qAuthor,
            superYudateAmount: qy.superYudateAmount ?? 0,
            createdAt: qy.createdAt.toISOString(),
          };
        }
      }
    }

    items.push({
      id: yudate.id,
      content: yudate.content,
      imageUrl: yudate.imageUrl ?? null,
      author,
      likeCount: likeCountMap.get(id) ?? 0,
      reyudateCount: reyudateCountMap.get(id) ?? 0,
      replyCount: replyCountMap.get(id) ?? 0,
      isLiked: userLikeSet.has(id),
      isReyudated: userReyudateSet.has(id),
      isSpoiler: yudate.isSpoiler ?? false,
      reactions: reactionsMap.get(id) ?? [],
      quotedYudate,
      replyToId: yudate.replyToId,
      superYudateAmount: yudate.superYudateAmount ?? 0,
      createdAt: yudate.createdAt.toISOString(),
    });
  }

  return { items, nextCursor: nextCursor ?? null };
}
