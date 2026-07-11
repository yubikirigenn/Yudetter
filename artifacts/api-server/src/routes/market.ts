import { Router } from "express";
import { db, usersTable, marketItemsTable, marketLikesTable, marketCommentsTable, notificationsTable, ydTransactionsTable } from "@workspace/db";
import { eq, and, desc, isNull, gte, lte, sql, not, inArray } from "drizzle-orm";
import { requireAuth, optionalAuth } from "../lib/auth";
import { buildUserProfile, buildUserProfilesBulk } from "../lib/buildResponse";
import { addYudedollar } from "../lib/yudedollar";
import { sseManager } from "../lib/sse";

const router = Router();

/**
 * オークションの遅延解決を行うヘルパー関数
 */
async function checkAndResolveAuction(itemId: number): Promise<any> {
  return await db.transaction(async (tx) => {
    const [item] = await tx
      .select()
      .from(marketItemsTable)
      .where(eq(marketItemsTable.id, itemId))
      .limit(1);

    if (!item || item.saleType !== "auction" || item.status !== "selling") {
      return item;
    }

    const now = new Date();
    if (item.auctionEndAt && item.auctionEndAt <= now) {
      // 終了時間を超えているため解決
      if (item.highestBidderId && item.highestBid && item.highestBid > 0) {
        // 落札者あり
        if (item.itemType === "user_id") {
          // ユーザーID販売の場合：ステータスを 'sold' に変更（IDのクレーム待ち）
          // 出品者のユーザー名を変更して元のIDを解放・保留状態にする
          const [seller] = await tx
            .select({ username: usersTable.username })
            .from(usersTable)
            .where(eq(usersTable.id, item.sellerId))
            .limit(1);

          if (seller) {
            const tempUsername = `${seller.username}_sold_${Date.now().toString(36).slice(-4)}`;
            // 出品者のIDを変更
            await tx
              .update(usersTable)
              .set({ username: tempUsername, updatedAt: new Date() })
              .where(eq(usersTable.id, item.sellerId));
          }

          const [updated] = await tx
            .update(marketItemsTable)
            .set({
              status: "sold",
              buyerId: item.highestBidderId,
              updatedAt: new Date(),
            })
            .where(eq(marketItemsTable.id, itemId))
            .returning();

          // 通知の登録
          await tx.insert(notificationsTable).values({
            userId: item.sellerId,
            type: `market_sell:${item.title}`,
            actorId: item.highestBidderId,
          });

          return updated;
        } else {
          // 通常のアイテム（画像・ゲーム）の場合：即時完了
          // 落札者から代金を引き落とし
          await addYudedollar(
            item.highestBidderId,
            -item.highestBid,
            "market_buy",
            `オークション落札購入: ${item.title}`,
            itemId,
            tx,
          );

          // 出品者に売却代金を支払う
          await addYudedollar(
            item.sellerId,
            item.highestBid,
            "market_sell",
            `マーケット出品落札: ${item.title}`,
            itemId,
            tx,
          );

          const [updated] = await tx
            .update(marketItemsTable)
            .set({
              status: "completed",
              buyerId: item.highestBidderId,
              updatedAt: new Date(),
            })
            .where(eq(marketItemsTable.id, itemId))
            .returning();

          // 通知の登録
          await tx.insert(notificationsTable).values({
            userId: item.sellerId,
            type: `market_sell:${item.title}`,
            actorId: item.highestBidderId,
          });

          return updated;
        }
      } else {
        // 入札者なし：終了
        const [updated] = await tx
          .update(marketItemsTable)
          .set({
            status: "completed", // 取引終了（流札）
            updatedAt: new Date(),
          })
          .where(eq(marketItemsTable.id, itemId))
          .returning();
        return updated;
      }
    }
    return item;
  });
}

/**
 * マーケット出品物レスポンスを整形するヘルパー
 */
async function buildMarketItemResponse(item: any, viewerUserId?: number) {
  let isBought = false;
  if (viewerUserId) {
    if (item.saleType === "normal") {
      const [boughtCheck] = await db
        .select()
        .from(ydTransactionsTable)
        .where(
          and(
            eq(ydTransactionsTable.userId, viewerUserId),
            eq(ydTransactionsTable.type, "market_buy"),
            eq(ydTransactionsTable.referenceId, item.id)
          )
        )
        .limit(1);
      if (boughtCheck) {
        isBought = true;
      }
    } else if (item.saleType === "auction") {
      const isFinished = item.status === "completed" || item.status === "sold";
      const isWinner = item.buyerId === viewerUserId || item.highestBidderId === viewerUserId;
      if (isFinished && isWinner) {
        isBought = true;
      }
    }
  }

  const [seller, buyer, highestBidder, [likes], [comments], likeCheck] = await Promise.all([
    buildUserProfile(item.sellerId, viewerUserId),
    item.buyerId ? buildUserProfile(item.buyerId, viewerUserId) : Promise.resolve(null),
    item.highestBidderId ? buildUserProfile(item.highestBidderId, viewerUserId) : Promise.resolve(null),
    db.select({ count: sql<number>`count(*)::int` }).from(marketLikesTable).where(eq(marketLikesTable.itemId, item.id)),
    db.select({ count: sql<number>`count(*)::int` }).from(marketCommentsTable).where(eq(marketCommentsTable.itemId, item.id)),
    viewerUserId
      ? db
          .select()
          .from(marketLikesTable)
          .where(and(eq(marketLikesTable.itemId, item.id), eq(marketLikesTable.userId, viewerUserId)))
          .limit(1)
      : Promise.resolve([]),
  ]);

  return {
    id: item.id,
    seller,
    buyer,
    title: item.title,
    description: item.description,
    itemType: item.itemType,
    itemData: item.itemData,
    thumbnailUrl: item.thumbnailUrl,
    price: item.price,
    saleType: item.saleType,
    status: item.status,
    stock: item.stock,
    auctionEndAt: item.auctionEndAt ? item.auctionEndAt.toISOString() : null,
    highestBid: item.highestBid,
    highestBidder,
    buyoutPrice: item.buyoutPrice,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
    likeCount: likes?.count ?? 0,
    commentCount: comments?.count ?? 0,
    isLiked: Array.isArray(likeCheck) && likeCheck.length > 0,
    isBought,
  };
}

/**
 * マーケット出品物レスポンスをバルクで高速に整形するヘルパー (N+1問題を回避)
 */
async function buildMarketItemsResponseBulk(items: any[], viewerUserId?: number) {
  if (items.length === 0) return [];

  const itemIds = items.map((item) => item.id);

  // 1. 全ユーザーIDを一括集計（出品者、購入者、最高入札者）
  const userIds = new Set<number>();
  for (const item of items) {
    if (item.sellerId) userIds.add(item.sellerId);
    if (item.buyerId) userIds.add(item.buyerId);
    if (item.highestBidderId) userIds.add(item.highestBidderId);
  }
  const uniqueUserIds = Array.from(userIds);

  // 2. ユーザープロフィールを一括取得
  const userProfileMap = uniqueUserIds.length > 0
    ? await buildUserProfilesBulk(uniqueUserIds, viewerUserId)
    : new Map();

  // 3. 各アイテムの取引履歴 (market_buy) の一括確認
  const boughtChecksMap = new Map<number, boolean>();
  if (viewerUserId && itemIds.length > 0) {
    const boughtRows = await db
      .select({ referenceId: ydTransactionsTable.referenceId })
      .from(ydTransactionsTable)
      .where(
        and(
          eq(ydTransactionsTable.userId, viewerUserId),
          eq(ydTransactionsTable.type, "market_buy"),
          inArray(ydTransactionsTable.referenceId, itemIds)
        )
      );
    for (const row of boughtRows) {
      if (row.referenceId) boughtChecksMap.set(row.referenceId, true);
    }
  }

  // 4. いいね数、コメント数、閲覧ユーザーのいいね状況を一括集計
  const likeCountsMap = new Map<number, number>();
  const commentCountsMap = new Map<number, number>();
  const userLikedMap = new Map<number, boolean>();

  if (itemIds.length > 0) {
    const [likeRows, commentRows, likedRows] = await Promise.all([
      db
        .select({ itemId: marketLikesTable.itemId, count: sql<number>`count(*)::int` })
        .from(marketLikesTable)
        .where(inArray(marketLikesTable.itemId, itemIds))
        .groupBy(marketLikesTable.itemId),
      db
        .select({ itemId: marketCommentsTable.itemId, count: sql<number>`count(*)::int` })
        .from(marketCommentsTable)
        .where(inArray(marketCommentsTable.itemId, itemIds))
        .groupBy(marketCommentsTable.itemId),
      viewerUserId
        ? db
            .select({ itemId: marketLikesTable.itemId })
            .from(marketLikesTable)
            .where(
              and(
                eq(marketLikesTable.userId, viewerUserId),
                inArray(marketLikesTable.itemId, itemIds)
              )
            )
        : Promise.resolve([]),
    ]);

    for (const r of likeRows) likeCountsMap.set(r.itemId, r.count);
    for (const r of commentRows) commentCountsMap.set(r.itemId, r.count);
    for (const r of likedRows) userLikedMap.set(r.itemId, true);
  }

  // 5. 各レスポンスの組み立て
  return items.map((item) => {
    let isBought = false;
    if (viewerUserId) {
      if (item.saleType === "normal") {
        isBought = boughtChecksMap.has(item.id);
      } else if (item.saleType === "auction") {
        const isFinished = item.status === "completed" || item.status === "sold";
        const isWinner = item.buyerId === viewerUserId || item.highestBidderId === viewerUserId;
        isBought = isFinished && isWinner;
      }
    }

    const seller = userProfileMap.get(item.sellerId) || null;
    const buyer = item.buyerId ? (userProfileMap.get(item.buyerId) || null) : null;
    const highestBidder = item.highestBidderId ? (userProfileMap.get(item.highestBidderId) || null) : null;

    return {
      id: item.id,
      seller,
      buyer,
      title: item.title,
      description: item.description,
      itemType: item.itemType,
      itemData: item.itemData,
      thumbnailUrl: item.thumbnailUrl,
      price: item.price,
      saleType: item.saleType,
      status: item.status,
      stock: item.stock,
      auctionEndAt: item.auctionEndAt ? item.auctionEndAt.toISOString() : null,
      highestBid: item.highestBid,
      highestBidder,
      buyoutPrice: item.buyoutPrice,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
      likeCount: likeCountsMap.get(item.id) ?? 0,
      commentCount: commentCountsMap.get(item.id) ?? 0,
      isLiked: userLikedMap.has(item.id),
      isBought,
    };
  });
}

// GET /market/items - 出品一覧の取得
router.get("/market/items", optionalAuth, async (req, res): Promise<void> => {
  try {
    const itemType = req.query.type as string | undefined;
    const status = req.query.status as string | undefined;

    const conditions = [];
    if (itemType) {
      conditions.push(eq(marketItemsTable.itemType, itemType));
    }
    const targetStatus = status === undefined ? "selling" : status;
    if (targetStatus !== "all") {
      conditions.push(eq(marketItemsTable.status, targetStatus));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    const rawItems = await db
      .select()
      .from(marketItemsTable)
      .where(whereClause)
      .orderBy(desc(marketItemsTable.createdAt));

    // オークション解決チェックを並列実行
    const resolvedItems = await Promise.all(
      rawItems.map((item) => checkAndResolveAuction(item.id))
    );

    // 再度 status でフィルタリング（解決によってステータスが変わった可能性があるため）
    const filteredItems = resolvedItems.filter((item) => {
      const targetStatus = status === undefined ? "selling" : status;
      return targetStatus === "all" || item.status === targetStatus;
    });

    const response = await buildMarketItemsResponseBulk(filteredItems, req.dbUserId);

    res.json(response);
  } catch (e) {
    console.error("Failed to fetch market items", e);
    res.status(500).json({ error: "商品リストの取得に失敗しました" });
  }
});

// POST /market/items - 新規出品
router.post("/market/items", requireAuth, async (req, res): Promise<void> => {
  try {
    const { title, description, itemType, itemData, price, saleType: rawSaleType, auctionDurationDays, thumbnailUrl, buyoutPrice, stock } = req.body;

    if (!title || !itemType || !itemData || price === undefined || !rawSaleType) {
      res.status(400).json({ error: "必須項目が不足しています" });
      return;
    }

    if (price < 1 || price > 999999999) {
      res.status(400).json({ error: "販売価格は 1YD から 999,999,999YD の範囲である必要があります" });
      return;
    }

    // ゲームの場合は固定価格・オークション対象外・在庫無限に設定
    const isGame = itemType === "game";
    const saleType = isGame ? "normal" : rawSaleType;

    // ユーザーID販売時のバリデーション
    if (itemType === "user_id") {
      const cleanId = itemData.trim().toLowerCase().replace(/^@/, "");
      const [user] = await db
        .select({ username: usersTable.username })
        .from(usersTable)
        .where(eq(usersTable.username, cleanId))
        .limit(1);

      if (!user) {
        res.status(400).json({ error: "自分自身の現在のユーザーIDのみ出品できます" });
        return;
      }
    }

    // 数量（在庫数）の判定: ゲームは無限(null)、それ以外は 1-99 または無限
    let finalStock: number | null = null;
    if (!isGame && stock !== undefined && stock !== null && stock !== "") {
      const parsedStock = parseInt(stock, 10);
      if (isNaN(parsedStock) || parsedStock < 1 || parsedStock > 99) {
        res.status(400).json({ error: "数量は 1 〜 99 の範囲で指定してください" });
        return;
      }
      finalStock = parsedStock;
    }

    let auctionEndAt: Date | null = null;
    if (saleType === "auction") {
      const days = Number(auctionDurationDays) || 3;
      auctionEndAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    }

    const [item] = await db
      .insert(marketItemsTable)
      .values({
        sellerId: req.dbUserId!,
        title,
        description: description ?? null,
        itemType,
        itemData,
        thumbnailUrl: thumbnailUrl ?? null,
        price,
        saleType,
        buyoutPrice: (saleType === "auction" && buyoutPrice) ? parseInt(buyoutPrice, 10) : null,
        status: "selling",
        stock: finalStock,
        auctionEndAt,
        highestBid: saleType === "auction" ? price : null,
      })
      .returning();

    const response = await buildMarketItemResponse(item, req.dbUserId);
    res.status(201).json(response);
  } catch (e) {
    console.error("Failed to create market item", e);
    res.status(500).json({ error: "出品に失敗しました" });
  }
});

// GET /market/items/:id - 商品詳細の取得
router.get("/market/items/:id", optionalAuth, async (req, res): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: "無効な商品IDです" });
      return;
    }

    // オークション解決チェック
    const resolved = await checkAndResolveAuction(id);
    if (!resolved) {
      res.status(404).json({ error: "商品が見つかりません" });
      return;
    }

    const response = await buildMarketItemResponse(resolved, req.dbUserId);
    res.json(response);
  } catch (e) {
    console.error("Failed to fetch market item detail", e);
    res.status(500).json({ error: "商品情報の取得に失敗しました" });
  }
});

// POST /market/items/:id/purchase - 購入またはオークション入札
router.post("/market/items/:id/purchase", requireAuth, async (req, res): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: "無効な商品IDです" });
      return;
    }

    // オークション終了チェック
    const item = await checkAndResolveAuction(id);
    if (!item) {
      res.status(404).json({ error: "商品が見つかりません" });
      return;
    }

    if (item.sellerId === req.dbUserId) {
      res.status(400).json({ error: "自分の出品した商品は購入・入札できません" });
      return;
    }

    // 購入者情報の取得
    const [buyer] = await db
      .select({ yudedollar: usersTable.yudedollar })
      .from(usersTable)
      .where(eq(usersTable.id, req.dbUserId!))
      .limit(1);

    if (!buyer) {
      res.status(404).json({ error: "ユーザー情報が見つかりません" });
      return;
    }

    if (item.saleType === "normal") {
      // 1. 通常販売の購入処理
      if (item.status !== "selling") {
        res.status(400).json({ error: "この商品は既に販売終了または保留中であるため購入できません" });
        return;
      }

      if (buyer.yudedollar < item.price) {
        res.status(400).json({ error: `YD残高が不足しています (必要: ${item.price}YD, 所持: ${buyer.yudedollar}YD)` });
        return;
      }

      await db.transaction(async (tx) => {
        // 購入者からYDを引き去る
        await addYudedollar(
          req.dbUserId!,
          -item.price,
          "market_buy",
          `マーケット商品購入: ${item.title}`,
          id,
          tx,
        );

        if (item.itemType === "user_id") {
          // ユーザーID販売の場合：ステータスを 'sold' に変更（クレーム待ち）
          // 出品者のユーザー名を仮IDに変更して解放
          const [seller] = await tx
            .select({ username: usersTable.username })
            .from(usersTable)
            .where(eq(usersTable.id, item.sellerId))
            .limit(1);

          if (seller) {
            const tempUsername = `${seller.username}_sold_${Date.now().toString(36).slice(-4)}`;
            await tx
              .update(usersTable)
              .set({ username: tempUsername, updatedAt: new Date() })
              .where(eq(usersTable.id, item.sellerId));
          }

          await tx
            .update(marketItemsTable)
            .set({
              status: "sold",
              buyerId: req.dbUserId!,
              updatedAt: new Date(),
            })
            .where(eq(marketItemsTable.id, id));
        } else {
          // 通常商品の場合：出品者にYDを支払い、ステータスと在庫を更新
          await addYudedollar(
            item.sellerId,
            item.price,
            "market_sell",
            `マーケット出品売却: ${item.title}`,
            id,
            tx,
          );

          let nextStock = item.stock;
          let nextStatus = item.status;

          if (item.stock !== null && item.stock !== undefined) {
            nextStock = Math.max(0, item.stock - 1);
            if (nextStock === 0) {
              nextStatus = "completed"; // 完売
            }
          } else {
            // 無限販売（stock === null）の場合は販売中のまま
            nextStatus = "selling";
          }

          await tx
            .update(marketItemsTable)
            .set({
              status: nextStatus,
              stock: nextStock,
              buyerId: req.dbUserId!,
              updatedAt: new Date(),
            })
            .where(eq(marketItemsTable.id, id));
        }
      });

      // 商品売却の通知登録 & SSE送信
      try {
        await db.insert(notificationsTable).values({
          userId: item.sellerId,
          type: `market_sell:${item.title}`,
          actorId: req.dbUserId!,
        });

        sseManager.notifyUser(item.sellerId, {
          type: "market_sell",
          actorName: req.user?.name || "誰か",
          actionMessage: `があなたの商品「${item.title}」を購入しました`,
        });
      } catch (err) {
        console.error("Failed to send market_sell notification", err);
      }

      res.json({ success: true, message: "購入が完了しました" });
    } else {
      // 2. オークション入札処理
      if (item.status !== "selling") {
        res.status(400).json({ error: "このオークションは既に終了しています" });
        return;
      }

      const { bidAmount } = req.body;
      const isBuyout = item.buyoutPrice !== null && bidAmount !== undefined && Number(bidAmount) >= item.buyoutPrice;
      const actualPayment = isBuyout ? item.buyoutPrice : Number(bidAmount);

      const minBid = item.highestBid ? item.highestBid + 1 : item.price;

      if (!isBuyout && (!bidAmount || Number(bidAmount) < minBid)) {
        res.status(400).json({ error: `入札額が低すぎます (最低入札額: ${minBid}YD)` });
        return;
      }

      if (buyer.yudedollar < actualPayment) {
        res.status(400).json({ error: `YD残高が不足しています (必要: ${actualPayment}YD, 所持: ${buyer.yudedollar}YD)` });
        return;
      }

      await db.transaction(async (tx) => {

        if (isBuyout) {
          // 即決落札
          await addYudedollar(
            req.dbUserId!,
            -actualPayment,
            "market_buy",
            `マーケット即決購入: ${item.title}`,
            id,
            tx,
          );

          if (item.itemType === "user_id") {
            const [seller] = await tx
              .select({ username: usersTable.username })
              .from(usersTable)
              .where(eq(usersTable.id, item.sellerId))
              .limit(1);

            if (seller) {
              const tempUsername = `${seller.username}_sold_${Date.now().toString(36).slice(-4)}`;
              await tx
                .update(usersTable)
                .set({ username: tempUsername, updatedAt: new Date() })
                .where(eq(usersTable.id, item.sellerId));
            }

            await tx
              .update(marketItemsTable)
              .set({
                status: "sold",
                buyerId: req.dbUserId!,
                highestBid: actualPayment,
                highestBidderId: req.dbUserId!,
                updatedAt: new Date(),
              })
              .where(eq(marketItemsTable.id, id));
          } else {
            await addYudedollar(
              item.sellerId,
              actualPayment,
              "market_sell",
              `マーケットオークション即決売却: ${item.title}`,
              id,
              tx,
            );

            await tx
              .update(marketItemsTable)
              .set({
                status: "completed",
                buyerId: req.dbUserId!,
                highestBid: actualPayment,
                highestBidderId: req.dbUserId!,
                updatedAt: new Date(),
              })
              .where(eq(marketItemsTable.id, id));
          }
        } else {
          // 通常入札 (入札中はお金を引かず、落札解決時に引くように変更)
          await tx
            .update(marketItemsTable)
            .set({
              highestBid: actualPayment,
              highestBidderId: req.dbUserId!,
              updatedAt: new Date(),
            })
            .where(eq(marketItemsTable.id, id));
        }
      });

      // 即決落札（Buyout）時の通知登録 & SSE送信
      if (isBuyout) {
        try {
          await db.insert(notificationsTable).values({
            userId: item.sellerId,
            type: `market_sell:${item.title}`,
            actorId: req.dbUserId!,
          });

          sseManager.notifyUser(item.sellerId, {
            type: "market_sell",
            actorName: req.user?.name || "誰か",
            actionMessage: `があなたの商品「${item.title}」を即決価格で購入しました`,
          });
        } catch (err) {
          console.error("Failed to send market_sell buyout notification", err);
        }
      }

      if (isBuyout) {
        res.json({ success: true, buyout: true, message: "即決購入が完了しました！" });
      } else {
        res.json({ success: true, message: "入札が完了しました" });
      }
    }
  } catch (e) {
    console.error("Failed to process market purchase", e);
    res.status(500).json({ error: "購入・入札処理に失敗しました" });
  }
});

// POST /market/items/:id/like - いいね追加
router.post("/market/items/:id/like", requireAuth, async (req, res): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: "無効な商品IDです" });
      return;
    }

    const [existing] = await db
      .select()
      .from(marketLikesTable)
      .where(and(eq(marketLikesTable.itemId, id), eq(marketLikesTable.userId, req.dbUserId!)))
      .limit(1);

    if (!existing) {
      await db.insert(marketLikesTable).values({
        itemId: id,
        userId: req.dbUserId!,
      });
    }

    res.json({ success: true });
  } catch (e) {
    console.error("Failed to like market item", e);
    res.status(500).json({ error: "いいねに失敗しました" });
  }
});

// DELETE /market/items/:id/like - いいね削除
router.delete("/market/items/:id/like", requireAuth, async (req, res): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: "無効な商品IDです" });
      return;
    }

    await db
      .delete(marketLikesTable)
      .where(and(eq(marketLikesTable.itemId, id), eq(marketLikesTable.userId, req.dbUserId!)));

    res.json({ success: true });
  } catch (e) {
    console.error("Failed to unlike market item", e);
    res.status(500).json({ error: "いいねの解除に失敗しました" });
  }
});

// GET /market/items/:id/comments - コメント一覧取得
router.get("/market/items/:id/comments", optionalAuth, async (req, res): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: "無効な商品IDです" });
      return;
    }

    const comments = await db
      .select()
      .from(marketCommentsTable)
      .where(eq(marketCommentsTable.itemId, id))
      .orderBy(marketCommentsTable.createdAt);

    const response = await Promise.all(
      comments.map(async (c) => ({
        id: c.id,
        itemId: c.itemId,
        user: await buildUserProfile(c.userId, req.dbUserId),
        comment: c.comment,
        createdAt: c.createdAt.toISOString(),
      }))
    );

    res.json(response);
  } catch (e) {
    console.error("Failed to fetch market comments", e);
    res.status(500).json({ error: "コメントの取得に失敗しました" });
  }
});

// POST /market/items/:id/comments - コメント投稿
router.post("/market/items/:id/comments", requireAuth, async (req, res): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    const { comment } = req.body;

    if (isNaN(id) || !comment || comment.trim() === "") {
      res.status(400).json({ error: "無効な入力です" });
      return;
    }

    const [newComment] = await db
      .insert(marketCommentsTable)
      .values({
        itemId: id,
        userId: req.dbUserId!,
        comment: comment.trim(),
      })
      .returning();

    const response = {
      id: newComment.id,
      itemId: newComment.itemId,
      user: await buildUserProfile(newComment.userId, req.dbUserId),
      comment: newComment.comment,
      createdAt: newComment.createdAt.toISOString(),
    };

    res.status(201).json(response);
  } catch (e) {
    console.error("Failed to create market comment", e);
    res.status(500).json({ error: "コメントの投稿に失敗しました" });
  }
});

// POST /market/items/:id/claim-id - 購入したユーザーIDの適用
router.post("/market/items/:id/claim-id", requireAuth, async (req, res): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: "無効な商品IDです" });
      return;
    }

    const [item] = await db
      .select()
      .from(marketItemsTable)
      .where(eq(marketItemsTable.id, id))
      .limit(1);

    if (!item || item.itemType !== "user_id" || item.status !== "sold") {
      res.status(400).json({ error: "この商品はID変更のクレーム対象ではありません" });
      return;
    }

    if (item.buyerId !== req.dbUserId) {
      res.status(403).json({ error: "このユーザーIDを購入した本人以外は適用できません" });
      return;
    }

    const cleanUsername = item.itemData.trim().toLowerCase().replace(/^@/, "");

    // 他に使われていないかチェック
    const [existing] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.username, cleanUsername))
      .limit(1);

    if (existing && existing.id !== req.dbUserId) {
      res.status(400).json({ error: "このIDは現在既に別のユーザーによって使用されています" });
      return;
    }

    await db.transaction(async (tx) => {
      // 購入者のIDを変更
      await tx
        .update(usersTable)
        .set({ username: cleanUsername, updatedAt: new Date() })
        .where(eq(usersTable.id, req.dbUserId!));

      // 購入者から落札代金を引き落とし
      const finalPrice = item.highestBid || item.price;
      await addYudedollar(
        req.dbUserId!,
        -finalPrice,
        "market_buy",
        `ユーザーID購入支払い: @${cleanUsername}`,
        id,
        tx,
      );

      // 出品者に売却代金を支払う
      await addYudedollar(
        item.sellerId,
        finalPrice,
        "market_sell",
        `マーケットユーザーID売却完了: @${cleanUsername}`,
        id,
        tx,
      );

      // 取引を 'completed' に更新
      await tx
        .update(marketItemsTable)
        .set({
          status: "completed",
          updatedAt: new Date(),
        })
        .where(eq(marketItemsTable.id, id));
    });

    res.json({ success: true, message: `ユーザーIDを @${cleanUsername} に変更しました` });
  } catch (e) {
    console.error("Failed to claim purchased username", e);
    res.status(500).json({ error: "ユーザーID of claim failed" });
  }
});

// DELETE /market/items/:id - 出品商品の削除
router.delete("/market/items/:id", requireAuth, async (req, res): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: "無効な商品IDです" });
      return;
    }

    const [item] = await db
      .select()
      .from(marketItemsTable)
      .where(eq(marketItemsTable.id, id))
      .limit(1);

    if (!item) {
      res.status(404).json({ error: "商品が見つかりません" });
      return;
    }

    if (item.sellerId !== req.dbUserId) {
      res.status(403).json({ error: "自分の出品した商品以外は削除できません" });
      return;
    }

    await db.delete(marketItemsTable).where(eq(marketItemsTable.id, id));

    res.json({ success: true, message: "出品商品を削除しました" });
  } catch (e) {
    console.error("Failed to delete market item", e);
    res.status(500).json({ error: "出品商品の削除に失敗しました" });
  }
});

export default router;
