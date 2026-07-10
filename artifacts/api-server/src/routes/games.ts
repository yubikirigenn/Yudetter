import { Router } from "express";
import { db, usersTable, gamesTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireAuth, optionalAuth } from "../lib/auth";
import { buildUserProfile } from "../lib/buildResponse";
import { addYudedollar } from "../lib/yudedollar";

const router = Router();

/**
 * ゲームレスポンスを整形するヘルパー
 */
async function buildGameResponse(game: any, viewerUserId?: number) {
  const creator = await buildUserProfile(game.creatorId, viewerUserId);
  return {
    id: game.id,
    creator,
    title: game.title,
    description: game.description,
    htmlContent: game.htmlContent, // 詳細取得時のみ利用
    playPrice: game.playPrice,
    createdAt: game.createdAt.toISOString(),
    updatedAt: game.updatedAt.toISOString(),
  };
}

// GET /games - ゲーム一覧の取得
router.get("/games", optionalAuth, async (req, res): Promise<void> => {
  try {
    const games = await db
      .select()
      .from(gamesTable)
      .orderBy(desc(gamesTable.createdAt));

    const response = await Promise.all(
      games.map(async (g) => {
        const creator = await buildUserProfile(g.creatorId, req.dbUserId);
        return {
          id: g.id,
          creator,
          title: g.title,
          description: g.description,
          playPrice: g.playPrice,
          createdAt: g.createdAt.toISOString(),
          updatedAt: g.updatedAt.toISOString(),
        };
      })
    );

    res.json(response);
  } catch (e) {
    console.error("Failed to fetch games", e);
    res.status(500).json({ error: "ゲーム一覧の取得に失敗しました" });
  }
});

// POST /games - ゲームの新規作成・公開
router.post("/games", requireAuth, async (req, res): Promise<void> => {
  try {
    const { title, description, htmlContent, playPrice } = req.body;

    if (!title || !htmlContent) {
      res.status(400).json({ error: "タイトルとHTMLコンテンツは必須です" });
      return;
    }

    const price = Number(playPrice) || 0;
    if (price < 0 || price > 999999999) {
      res.status(400).json({ error: "プレイ料金が不正です" });
      return;
    }

    const [game] = await db
      .insert(gamesTable)
      .values({
        creatorId: req.dbUserId!,
        title,
        description: description ?? null,
        htmlContent,
        playPrice: price,
      })
      .returning();

    const response = await buildGameResponse(game, req.dbUserId);
    res.status(201).json(response);
  } catch (e) {
    console.error("Failed to publish game", e);
    res.status(500).json({ error: "ゲームの公開に失敗しました" });
  }
});

// GET /games/:id - ゲーム詳細・コードの取得
router.get("/games/:id", optionalAuth, async (req, res): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: "無効なゲームIDです" });
      return;
    }

    const [game] = await db
      .select()
      .from(gamesTable)
      .where(eq(gamesTable.id, id))
      .limit(1);

    if (!game) {
      res.status(404).json({ error: "ゲームが見つかりません" });
      return;
    }

    const response = await buildGameResponse(game, req.dbUserId);
    res.json(response);
  } catch (e) {
    console.error("Failed to fetch game detail", e);
    res.status(500).json({ error: "ゲーム情報の取得に失敗しました" });
  }
});

// PUT /games/:id - ゲームの編集・更新
router.put("/games/:id", requireAuth, async (req, res): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: "無効なゲームIDです" });
      return;
    }

    const { title, description, htmlContent, playPrice } = req.body;
    if (!title || !htmlContent) {
      res.status(400).json({ error: "タイトルとHTMLコンテンツは必須です" });
      return;
    }

    const price = Number(playPrice) || 0;
    if (price < 0 || price > 999999999) {
      res.status(400).json({ error: "プレイ料金が不正です" });
      return;
    }

    const [existingGame] = await db
      .select()
      .from(gamesTable)
      .where(eq(gamesTable.id, id))
      .limit(1);

    if (!existingGame) {
      res.status(404).json({ error: "ゲームが見つかりません" });
      return;
    }

    if (existingGame.creatorId !== req.dbUserId) {
      res.status(403).json({ error: "自分が作成したゲームのみ編集できます" });
      return;
    }

    const [updatedGame] = await db
      .update(gamesTable)
      .set({
        title,
        description: description ?? null,
        htmlContent,
        playPrice: price,
        updatedAt: new Date(),
      })
      .where(eq(gamesTable.id, id))
      .returning();

    const response = await buildGameResponse(updatedGame, req.dbUserId);
    res.json(response);
  } catch (e) {
    console.error("Failed to update game", e);
    res.status(500).json({ error: "ゲームの更新に失敗しました" });
  }
});

// POST /games/:id/charge - ゲーム内決済 (YD決済)
router.post("/games/:id/charge", requireAuth, async (req, res): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    const { amount, description } = req.body;

    if (isNaN(id) || !amount || amount <= 0) {
      res.status(400).json({ error: "無効な決済要求です" });
      return;
    }

    const [game] = await db
      .select()
      .from(gamesTable)
      .where(eq(gamesTable.id, id))
      .limit(1);

    if (!game) {
      res.status(404).json({ error: "ゲームが見つかりません" });
      return;
    }

    // プレイヤーの残高確認
    const [player] = await db
      .select({ yudedollar: usersTable.yudedollar })
      .from(usersTable)
      .where(eq(usersTable.id, req.dbUserId!))
      .limit(1);

    if (!player || player.yudedollar < amount) {
      res.status(400).json({ error: "YD残高が不足しています" });
      return;
    }

    // 決済処理（トランザクション）
    let txId: number | null = null;
    await db.transaction(async (tx) => {
      // 1. プレイヤーからYD引き去り
      await addYudedollar(
        req.dbUserId!,
        -amount,
        "game_charge",
        `YGSゲーム決済: ${game.title} - ${description || "アイテム購入"}`,
        id,
        tx,
      );

      // 2. ゲーム制作者へYD支払い
      txId = await addYudedollar(
        game.creatorId,
        amount,
        "game_revenue",
        `YGSゲーム収益: ${game.title} - ${description || "アイテム購入"}`,
        id,
        tx,
      );
    });

    res.json({ success: true, transactionId: txId });
  } catch (e) {
    console.error("Failed to process game charge", e);
    res.status(500).json({ error: "ゲーム内決済に失敗しました" });
  }
});

export default router;
