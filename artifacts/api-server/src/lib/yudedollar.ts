import { db, usersTable, ydTransactionsTable, yudatesTable, followsTable, rankingResetsTable } from "@workspace/db";
import { eq, and, gte, lte, sql, desc, isNotNull } from "drizzle-orm";

/**
 * 日本標準時 (JST) での日付文字列 (YYYY-MM-DD) を取得するヘルパー
 */
export function getJstDateString(date: Date = new Date()): string {
  const jstTime = date.getTime() + (9 * 60 * 60 * 1000);
  const jstDate = new Date(jstTime);
  return jstDate.toISOString().split("T")[0];
}

/**
 * 日本標準時 (JST) での昨日の日付文字列 (YYYY-MM-DD) を取得するヘルパー
 */
export function getJstYesterdayString(date: Date = new Date()): string {
  const yesterday = new Date(date.getTime() - (24 * 60 * 60 * 1000));
  return getJstDateString(yesterday);
}

/**
 * 日本標準時 (JST) での「今日の0:00」から「23:59:59」までのUTC Date範囲を返すヘルパー
 */
export function getJstTodayRange(): { start: Date; end: Date } {
  const now = new Date();
  const jstTime = now.getTime() + (9 * 60 * 60 * 1000);
  const jstDate = new Date(jstTime);
  
  jstDate.setUTCHours(0, 0, 0, 0);
  const start = new Date(jstDate.getTime() - (9 * 60 * 60 * 1000));
  const end = new Date(start.getTime() + (24 * 60 * 60 * 1000) - 1);
  
  return { start, end };
}

/**
 * ユーザーのユデドル (YD) 残高を変更し、取引履歴をインサートする
 * @returns 更新後の残高
 */
export async function addYudedollar(
  userId: number,
  amount: number,
  type: string,
  description: string,
  referenceId?: number,
  tx?: any,
): Promise<number> {
  const execute = async (c: any) => {
    // 現在の残高を取得 (競合を防ぐため FOR UPDATE ロックをかける)
    const [user] = await c
      .select({ yudedollar: usersTable.yudedollar })
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1)
      .for("update");

    const currentBalance = user?.yudedollar ?? 0;
    // 残高が0未満にならないように調整
    const newBalance = Math.max(0, currentBalance + amount);
    // 実際に変動した額
    const actualDiff = newBalance - currentBalance;

    // 残高を更新
    await c
      .update(usersTable)
      .set({ yudedollar: newBalance, updatedAt: new Date() })
      .where(eq(usersTable.id, userId));

    // 取引履歴を記録
    await c.insert(ydTransactionsTable).values({
      userId,
      amount: actualDiff,
      type,
      description,
      referenceId: referenceId ?? null,
    });

    return newBalance;
  };

  if (tx) {
    return await execute(tx);
  } else {
    return await db.transaction(async (newTx) => {
      return await execute(newTx);
    });
  }
}

/**
 * ログインボーナスのチェックと付与を行う
 */
export async function checkAndApplyLoginBonus(userId: number) {
  const todayStr = getJstDateString();
  const yesterdayStr = getJstYesterdayString();

  return await db.transaction(async (tx) => {
    const [user] = await tx
      .select({
        lastLoginDate: usersTable.lastLoginDate,
        consecutiveLoginDays: usersTable.consecutiveLoginDays,
        yudedollar: usersTable.yudedollar,
      })
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1)
      .for("update");

    if (!user) return null;

    // すでに今日ログイン済みなら何もしない
    if (user.lastLoginDate === todayStr) {
      return { success: false, consecutiveDays: user.consecutiveLoginDays, bonus: 0, balance: user.yudedollar };
    }

    let nextConsecutiveDays = 1;
    if (user.lastLoginDate === yesterdayStr) {
      // 連続ログイン成功
      nextConsecutiveDays = (user.consecutiveLoginDays ?? 0) + 1;
    } else {
      // 連続ログイン途切れ
      nextConsecutiveDays = 1;
    }

    // ログインボーナスの計算 (連続日数 * 100 YD、上限15日目=1500YD)
    const bonus = Math.min(nextConsecutiveDays, 15) * 100;

    // ユーザー情報を更新
    await tx
      .update(usersTable)
      .set({
        lastLoginDate: todayStr,
        consecutiveLoginDays: nextConsecutiveDays,
      })
      .where(eq(usersTable.id, userId));

    // YDを付与し、取引履歴をインサート (txを渡してトランザクションをネストさせない)
    const newBalance = await addYudedollar(
      userId,
      bonus,
      "login_bonus",
      `連続ログイン ${nextConsecutiveDays} 日目ボーナス`,
      undefined,
      tx,
    );

    return {
      success: true,
      consecutiveDays: nextConsecutiveDays,
      bonus,
      balance: newBalance,
    };
  });
}

/**
 * 投稿作成時のボーナス付与 (1投稿=5YD, 1日最大100YD)
 */
export async function checkAndApplyPostBonus(userId: number, postId: number) {
  const { start, end } = getJstTodayRange();

  // 今日の投稿作成による獲得合計を取得
  const todayTransactions = await db
    .select({ amount: ydTransactionsTable.amount })
    .from(ydTransactionsTable)
    .where(
      and(
        eq(ydTransactionsTable.userId, userId),
        eq(ydTransactionsTable.type, "post_create"),
        gte(ydTransactionsTable.createdAt, start),
        lte(ydTransactionsTable.createdAt, end),
      ),
    );

  const totalToday = todayTransactions.reduce((acc, t) => acc + t.amount, 0);

  if (totalToday >= 100) {
    return { success: false, added: 0, totalToday };
  }

  // 1投稿につき5YD、残り枠に合わせて調整
  const added = Math.min(5, 100 - totalToday);
  const newBalance = await addYudedollar(
    userId,
    added,
    "post_create",
    "新規投稿ボーナス",
    postId,
  );

  return { success: true, added, totalToday: totalToday + added, balance: newBalance };
}

/**
 * 投稿削除時の減算 (-5YD)
 */
export async function applyPostDeletePenalty(userId: number, postId: number) {
  await addYudedollar(userId, -5, "post_delete", "投稿の取り消しに伴う減算", postId);
}

/**
 * 投稿詳細閲覧時のボーナス付与 (1閲覧=1YD, 別枠で1日最大100YD)
 */
export async function checkAndApplyViewBonus(userId: number, postId: number) {
  // 自分の投稿なら何もしない
  const [post] = await db
    .select({ authorId: yudatesTable.authorId })
    .from(yudatesTable)
    .where(eq(yudatesTable.id, postId))
    .limit(1);

  if (!post || post.authorId === userId) {
    return { success: false, added: 0 };
  }

  const { start, end } = getJstTodayRange();

  // 今日、同じ投稿をすでに閲覧したかチェック（重複防止）
  const [alreadyViewed] = await db
    .select({ id: ydTransactionsTable.id })
    .from(ydTransactionsTable)
    .where(
      and(
        eq(ydTransactionsTable.userId, userId),
        eq(ydTransactionsTable.type, "post_view"),
        eq(ydTransactionsTable.referenceId, postId),
        gte(ydTransactionsTable.createdAt, start),
        lte(ydTransactionsTable.createdAt, end),
      ),
    )
    .limit(1);

  if (alreadyViewed) {
    return { success: false, added: 0 };
  }

  // 今日の閲覧による獲得合計を取得
  const todayTransactions = await db
    .select({ amount: ydTransactionsTable.amount })
    .from(ydTransactionsTable)
    .where(
      and(
        eq(ydTransactionsTable.userId, userId),
        eq(ydTransactionsTable.type, "post_view"),
        gte(ydTransactionsTable.createdAt, start),
        lte(ydTransactionsTable.createdAt, end),
      ),
    );

  const totalToday = todayTransactions.reduce((acc, t) => acc + t.amount, 0);

  if (totalToday >= 100) {
    return { success: false, added: 0 };
  }

  const added = 1;
  await addYudedollar(userId, added, "post_view", "投稿閲覧ボーナス", postId);
  return { success: true, added };
}

let isRankingProcessing = false;

/**
 * 日間・週間ランキングのリセットおよび報酬配布の遅延実行
 */
export async function checkAndApplyRankingRewards() {
  if (isRankingProcessing) {
    return;
  }
  isRankingProcessing = true;

  try {
    const now = new Date();
    const todayStr = getJstDateString(now);

    // 1. 日間ランキングのリセット＆配布チェック
    await db.transaction(async (tx) => {
    // 最後に実行された日間キーを取得（排他ロックをかけて多重実行と競合を防ぐ）
    const [lastDaily] = await tx
      .select({ lastResetKey: rankingResetsTable.lastResetKey })
      .from(rankingResetsTable)
      .where(eq(rankingResetsTable.type, "daily"))
      .orderBy(desc(rankingResetsTable.id))
      .limit(1)
      .for("update");

    // 昨日の日付 (JST基準)
    const yesterdayStr = getJstYesterdayString(now);

    // 昨日の日付がまだ処理されていなければ実行
    if (!lastDaily || lastDaily.lastResetKey !== yesterdayStr) {
      console.log(`[Ranking] Running daily rewards for ${yesterdayStr}`);

      // 昨日の JST 0:00 〜 23:59:59 までの範囲を計算
      const yesterday = new Date(now.getTime() - (24 * 60 * 60 * 1000));
      const jstYesterday = new Date(yesterday.getTime() + (9 * 60 * 60 * 1000));
      jstYesterday.setUTCHours(0, 0, 0, 0);
      const start = new Date(jstYesterday.getTime() - (9 * 60 * 60 * 1000));
      const end = new Date(start.getTime() + (24 * 60 * 60 * 1000) - 1);

      // 昨日の投稿数ランキングを集計 (optIn しているユーザーのみ、投稿数 > 0)
      const dailyPostRank = await tx
        .select({
          userId: yudatesTable.authorId,
          count: sql<number>`count(*)::int`,
        })
        .from(yudatesTable)
        .innerJoin(usersTable, eq(yudatesTable.authorId, usersTable.id))
        .where(
          and(
            eq(usersTable.rankingOptIn, true),
            gte(yudatesTable.createdAt, start),
            lte(yudatesTable.createdAt, end),
          ),
        )
        .groupBy(yudatesTable.authorId)
        .orderBy(sql`count(*) DESC`)
        .limit(10);

      // 昨日のフォロワー増分ランキング
      const dailyFollowRank = await tx
        .select({
          userId: followsTable.followingId,
          count: sql<number>`count(*)::int`,
        })
        .from(followsTable)
        .innerJoin(usersTable, eq(followsTable.followingId, usersTable.id))
        .where(
          and(
            eq(usersTable.rankingOptIn, true),
            gte(followsTable.createdAt, start),
            lte(followsTable.createdAt, end),
          ),
        )
        .groupBy(followsTable.followingId)
        .orderBy(sql`count(*) DESC`)
        .limit(10);

      // 報酬付与ヘルパー
      const payRewards = async (rankList: Array<{ userId: number; count: number }>, rankType: string) => {
        const rewardAmounts = [2000, 800, 500, 100, 100, 100, 100, 100, 100, 100];
        for (let i = 0; i < rankList.length; i++) {
          const user = rankList[i];
          const rank = i + 1;
          const reward = rewardAmounts[i] ?? 0;
          if (reward > 0) {
            await addYudedollar(
              user.userId,
              reward,
              "ranking_reward",
              `日間${rankType}ランキング第 ${rank} 位報酬 (${yesterdayStr})`,
              undefined,
              tx,
            );
          }
        }
      };

      await payRewards(dailyPostRank, "投稿数");
      await payRewards(dailyFollowRank, "フォロワー数");

      // リセット情報を記録
      await tx.insert(rankingResetsTable).values({
        type: "daily",
        lastResetKey: yesterdayStr,
      });

      // 総合フォロワー数ランキング上位3名にバッジを再配布
      await updateAllTimeBadge(tx);
    }
  });

  // 2. 週間ランキングのリセット＆配布チェック (毎週月曜に判定)
  // 月曜日かどうかを判定 (JST基準)
  const jstTime = now.getTime() + (9 * 60 * 60 * 1000);
  const jstDate = new Date(jstTime);
  const dayOfWeek = jstDate.getUTCDay(); // 0: 日, 1: 月, 2: 火, ...

  if (dayOfWeek === 1) { // 月曜日
    const mondayStr = todayStr; // 今日の日付キー

    await db.transaction(async (tx) => {
      // すでに今週の月曜日分が処理されていなければ実行（排他ロック）
      const [lastWeekly] = await tx
        .select({ lastResetKey: rankingResetsTable.lastResetKey })
        .from(rankingResetsTable)
        .where(eq(rankingResetsTable.type, "weekly"))
        .orderBy(desc(rankingResetsTable.id))
        .limit(1)
        .for("update");

      // すでに今週の月曜日分が処理されていなければ実行
      if (!lastWeekly || lastWeekly.lastResetKey !== mondayStr) {
        console.log(`[Ranking] Running weekly rewards for week of ${mondayStr}`);

        // 過去7日間の範囲を計算 (先週の月曜 0:00 〜 昨日の日曜 23:59:59)
        const start = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
        const end = new Date(now.getTime() - 1000); // ほぼ今

        // 投稿数ランキング
        const weeklyPostRank = await tx
          .select({
            userId: yudatesTable.authorId,
            count: sql<number>`count(*)::int`,
          })
          .from(yudatesTable)
          .innerJoin(usersTable, eq(yudatesTable.authorId, usersTable.id))
          .where(
            and(
              eq(usersTable.rankingOptIn, true),
              gte(yudatesTable.createdAt, start),
              lte(yudatesTable.createdAt, end),
            ),
          )
          .groupBy(yudatesTable.authorId)
          .orderBy(sql`count(*) DESC`)
          .limit(10);

        // フォロワー数ランキング
        const weeklyFollowRank = await tx
          .select({
            userId: followsTable.followingId,
            count: sql<number>`count(*)::int`,
          })
          .from(followsTable)
          .innerJoin(usersTable, eq(followsTable.followingId, usersTable.id))
          .where(
            and(
              eq(usersTable.rankingOptIn, true),
              gte(followsTable.createdAt, start),
              lte(followsTable.createdAt, end),
            ),
          )
          .groupBy(followsTable.followingId)
          .orderBy(sql`count(*) DESC`)
          .limit(10);

        // 報酬付与 (日間の7倍)
        const payWeeklyRewards = async (rankList: Array<{ userId: number; count: number }>, rankType: string) => {
          const rewardAmounts = [14000, 5600, 3500, 700, 700, 700, 700, 700, 700, 700];
          for (let i = 0; i < rankList.length; i++) {
            const user = rankList[i];
            const rank = i + 1;
            const reward = rewardAmounts[i] ?? 0;
            if (reward > 0) {
              await addYudedollar(
                user.userId,
                reward,
                "ranking_reward",
                `週間${rankType}ランキング第 ${rank} 位報酬 (週: ${mondayStr})`,
                undefined,
                tx,
              );
            }
          }
        };

        await payWeeklyRewards(weeklyPostRank, "投稿数");
        await payWeeklyRewards(weeklyFollowRank, "フォロワー数");

        // リセット情報を記録
        await tx.insert(rankingResetsTable).values({
          type: "weekly",
          lastResetKey: mondayStr,
        });
      }
    });
  }
  
  // 常にバッジ情報を最新化する（オプトインユーザーの中での最新のフォロワー数上位3名）
  await updateAllTimeBadge();
  
  } finally {
    isRankingProcessing = false;
  }
}

/**
 * 総合フォロワー数上位3名（ランキング参加者のみ）にバッジを再配布する
 */
export async function updateAllTimeBadge(tx?: any) {
  const execute = async (c: any) => {
    // 総合フォロワー数ランキング上位3名を取得 (ランキングオプトインしているユーザーのみ)
    const topAllTime = await c
      .select({ id: usersTable.id })
      .from(usersTable)
      .leftJoin(followsTable, eq(usersTable.id, followsTable.followingId))
      .where(eq(usersTable.rankingOptIn, true))
      .groupBy(usersTable.id)
      .orderBy(sql`count(${followsTable.followingId}) DESC`)
      .limit(3);

    // 現在バッジを持っている人のみバッジをクリア (テーブル全体のロックを防ぐ)
    await c
      .update(usersTable)
      .set({ badgeType: null })
      .where(isNotNull(usersTable.badgeType));

    // 上位3名に割り当て
    if (topAllTime[0]) await c.update(usersTable).set({ badgeType: "gold" }).where(eq(usersTable.id, topAllTime[0].id));
    if (topAllTime[1]) await c.update(usersTable).set({ badgeType: "silver" }).where(eq(usersTable.id, topAllTime[1].id));
    if (topAllTime[2]) await c.update(usersTable).set({ badgeType: "bronze" }).where(eq(usersTable.id, topAllTime[2].id));
  };

  if (tx) {
    await execute(tx);
  } else {
    return await db.transaction(async (newTx) => {
      await execute(newTx);
    });
  }
}
