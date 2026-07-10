import { Router } from "express";
import { db, usersTable, yudatesTable, followsTable } from "@workspace/db";
import { eq, and, gte, lte, sql, desc } from "drizzle-orm";
import { requireAuth, optionalAuth } from "../lib/auth";
import { buildUserProfile } from "../lib/buildResponse";
import { getJstTodayRange, updateAllTimeBadge } from "../lib/yudedollar";

const router = Router();

/**
 * 日本標準時 (JST) での今週の月曜日 0:00 の UTC Date を返すヘルパー
 */
function getJstThisWeekStart(): Date {
  const now = new Date();
  const jstTime = now.getTime() + (9 * 60 * 60 * 1000);
  const jstDate = new Date(jstTime);
  
  const day = jstDate.getUTCDay(); // 0: 日, 1: 月, 2: 火, ...
  // 月曜日(1)からの差分を引いて月曜にする。日曜(0)の場合は-6する
  const diff = jstDate.getUTCDate() - day + (day === 0 ? -6 : 1);
  jstDate.setUTCDate(diff);
  jstDate.setUTCHours(0, 0, 0, 0);
  
  return new Date(jstDate.getTime() - (9 * 60 * 60 * 1000));
}

/**
 * ランキングデータ（ユーザープロフィール + スコア）を組み立てる
 */
async function buildRankingList(
  dbRows: Array<{ userId: number; score: number }>,
  viewerUserId?: number,
) {
  // 投稿数またはフォロワー増分が 0 のユーザーは非表示にする
  const filtered = dbRows.filter((row) => row.score > 0);

  const results = await Promise.all(
    filtered.map(async (row) => {
      const user = await buildUserProfile(row.userId, viewerUserId);
      return {
        user,
        score: row.score,
      };
    })
  );

  // プロフィール取得に失敗したユーザーを排除
  return results.filter((r) => r.user !== null);
}

// GET /rankings - 日間・週間・総合ランキングの取得
router.get("/rankings", optionalAuth, async (req, res): Promise<void> => {
  try {
    const today = getJstTodayRange();
    const thisWeekStart = getJstThisWeekStart();

    // 1. 日間ランキング集計 (今日 JST 0:00 〜 23:59:59)
    // 1-a. 日間投稿数
    const dailyPostRows = await db
      .select({
        userId: yudatesTable.authorId,
        score: sql<number>`count(*)::int`,
      })
      .from(yudatesTable)
      .innerJoin(usersTable, eq(yudatesTable.authorId, usersTable.id))
      .where(
        and(
          eq(usersTable.rankingOptIn, true),
          gte(yudatesTable.createdAt, today.start),
          lte(yudatesTable.createdAt, today.end),
        )
      )
      .groupBy(yudatesTable.authorId)
      .orderBy(sql`count(*) DESC`)
      .limit(20);

    // 1-b. 日間フォロワー増分
    const dailyFollowRows = await db
      .select({
        userId: followsTable.followingId,
        score: sql<number>`count(*)::int`,
      })
      .from(followsTable)
      .innerJoin(usersTable, eq(followsTable.followingId, usersTable.id))
      .where(
        and(
          eq(usersTable.rankingOptIn, true),
          gte(followsTable.createdAt, today.start),
          lte(followsTable.createdAt, today.end),
        )
      )
      .groupBy(followsTable.followingId)
      .orderBy(sql`count(*) DESC`)
      .limit(20);

    // 2. 週間ランキング集計 (今週月曜 JST 0:00 〜 現在)
    // 2-a. 週間投稿数
    const weeklyPostRows = await db
      .select({
        userId: yudatesTable.authorId,
        score: sql<number>`count(*)::int`,
      })
      .from(yudatesTable)
      .innerJoin(usersTable, eq(yudatesTable.authorId, usersTable.id))
      .where(
        and(
          eq(usersTable.rankingOptIn, true),
          gte(yudatesTable.createdAt, thisWeekStart),
        )
      )
      .groupBy(yudatesTable.authorId)
      .orderBy(sql`count(*) DESC`)
      .limit(20);

    // 2-b. 週間フォロワー増分
    const weeklyFollowRows = await db
      .select({
        userId: followsTable.followingId,
        score: sql<number>`count(*)::int`,
      })
      .from(followsTable)
      .innerJoin(usersTable, eq(followsTable.followingId, usersTable.id))
      .where(
        and(
          eq(usersTable.rankingOptIn, true),
          gte(followsTable.createdAt, thisWeekStart),
        )
      )
      .groupBy(followsTable.followingId)
      .orderBy(sql`count(*) DESC`)
      .limit(20);

    // 3. 総合ランキング集計 (全期間累計)
    // 3-a. 総合投稿数
    const allTimePostRows = await db
      .select({
        userId: yudatesTable.authorId,
        score: sql<number>`count(*)::int`,
      })
      .from(yudatesTable)
      .innerJoin(usersTable, eq(yudatesTable.authorId, usersTable.id))
      .where(eq(usersTable.rankingOptIn, true))
      .groupBy(yudatesTable.authorId)
      .orderBy(sql`count(*) DESC`)
      .limit(20);

    // 3-b. 総合フォロワー数 (現在のフォロワー総数)
    const allTimeFollowRows = await db
      .select({
        userId: usersTable.id,
        score: sql<number>`count(${followsTable.followingId})::int`,
      })
      .from(usersTable)
      .leftJoin(followsTable, eq(usersTable.id, followsTable.followingId))
      .where(eq(usersTable.rankingOptIn, true))
      .groupBy(usersTable.id)
      .orderBy(sql`count(${followsTable.followingId}) DESC`)
      .limit(20);

    // 各ランキングデータを並列で構築
    const [
      dailyPost,
      dailyFollow,
      weeklyPost,
      weeklyFollow,
      allTimePost,
      allTimeFollow,
    ] = await Promise.all([
      buildRankingList(dailyPostRows, req.dbUserId),
      buildRankingList(dailyFollowRows, req.dbUserId),
      buildRankingList(weeklyPostRows, req.dbUserId),
      buildRankingList(weeklyFollowRows, req.dbUserId),
      buildRankingList(allTimePostRows, req.dbUserId),
      buildRankingList(allTimeFollowRows, req.dbUserId),
    ]);

    res.json({
      daily: {
        post: dailyPost,
        follower: dailyFollow,
      },
      weekly: {
        post: weeklyPost,
        follower: weeklyFollow,
      },
      allTime: {
        post: allTimePost,
        follower: allTimeFollow, // DTOの定義に合わせて allTime.follower にマッピング
      },
    });
  } catch (e) {
    console.error("Failed to fetch rankings", e);
    res.status(500).json({ error: "ランキングデータの取得に失敗しました" });
  }
});

// POST /rankings/opt-in - ランキングに参加する
router.post("/rankings/opt-in", requireAuth, async (req, res): Promise<void> => {
  try {
    await db
      .update(usersTable)
      .set({ rankingOptIn: true, updatedAt: new Date() })
      .where(eq(usersTable.id, req.dbUserId!));
    
    // バッジ情報をリアルタイムに再評価して同期
    await updateAllTimeBadge();

    res.json({ success: true });
  } catch (e) {
    console.error("Failed to opt-in rankings", e);
    res.status(500).json({ error: "ランキング参加処理に失敗しました" });
  }
});

// POST /rankings/opt-out - ランキングから退出する
router.post("/rankings/opt-out", requireAuth, async (req, res): Promise<void> => {
  try {
    await db
      .update(usersTable)
      .set({ rankingOptIn: false, badgeType: null, updatedAt: new Date() })
      .where(eq(usersTable.id, req.dbUserId!));

    // 他の参加者の中でのバッジ情報を再評価して同期
    await updateAllTimeBadge();

    res.json({ success: true });
  } catch (e) {
    console.error("Failed to opt-out rankings", e);
    res.status(500).json({ error: "ランキング退出処理に失敗しました" });
  }
});

export default router;
