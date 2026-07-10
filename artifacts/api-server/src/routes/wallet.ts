import { Router } from "express";
import { db, ydTransactionsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireAuth } from "../lib/auth";

const router = Router();

// GET /wallet/history - ウォレットの取引履歴を取得
router.get("/wallet/history", requireAuth, async (req, res): Promise<void> => {
  try {
    const transactions = await db
      .select()
      .from(ydTransactionsTable)
      .where(eq(ydTransactionsTable.userId, req.dbUserId!))
      .orderBy(desc(ydTransactionsTable.createdAt));

    const response = transactions.map((t) => ({
      id: t.id,
      userId: t.userId,
      amount: t.amount,
      type: t.type,
      description: t.description,
      referenceId: t.referenceId,
      createdAt: t.createdAt.toISOString(),
    }));

    res.json(response);
  } catch (e) {
    console.error("Failed to fetch wallet history", e);
    res.status(500).json({ error: "取引履歴の取得に失敗しました" });
  }
});

export default router;
