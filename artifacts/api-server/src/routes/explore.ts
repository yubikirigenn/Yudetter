import { Router } from "express";
import { desc, and, isNull, ilike, or, sql } from "drizzle-orm";
import { db, yudatesTable, usersTable } from "@workspace/db";
import { optionalAuth } from "../lib/auth";
import { buildYudatePage, buildUserProfile } from "../lib/buildResponse";

const router = Router();

// GET /explore - trending / recent public yudates
router.get("/explore", optionalAuth, async (req, res): Promise<void> => {
  const limit = Math.min(Number(req.query.limit) || 20, 50);
  const cursor = req.query.cursor ? Number(req.query.cursor) : null;

  const { lt } = await import("drizzle-orm");

  const rows = await db
    .select({ id: yudatesTable.id })
    .from(yudatesTable)
    .where(
      and(
        isNull(yudatesTable.replyToId),
        cursor ? lt(yudatesTable.id, cursor) : undefined,
      ),
    )
    .orderBy(desc(yudatesTable.id))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const ids = rows.slice(0, limit).map((r) => r.id);
  const nextCursor = hasMore ? ids[ids.length - 1] : null;

  const page = await buildYudatePage(ids, req.dbUserId, nextCursor);
  res.json(page);
});

// GET /explore/search?q=...&type=yudates|users|all
router.get("/explore/search", optionalAuth, async (req, res): Promise<void> => {
  const q = (req.query.q as string)?.trim();
  const type = (req.query.type as string) || "all";

  if (!q) {
    res.json({ yudates: [], users: [] });
    return;
  }

  const pattern = `%${q}%`;

  const [yudateRows, userRows] = await Promise.all([
    type === "users"
      ? Promise.resolve([])
      : db
          .select({ id: yudatesTable.id })
          .from(yudatesTable)
          .where(and(ilike(yudatesTable.content, pattern), isNull(yudatesTable.replyToId)))
          .orderBy(desc(yudatesTable.id))
          .limit(20),

    type === "yudates"
      ? Promise.resolve([])
      : db
          .select({ id: usersTable.id })
          .from(usersTable)
          .where(
            or(
              ilike(usersTable.username, pattern),
              ilike(usersTable.displayName, pattern),
            ),
          )
          .limit(10),
  ]);

  const [yudates, users] = await Promise.all([
    buildYudatePage(yudateRows.map((r) => r.id), req.dbUserId, null),
    Promise.all(userRows.map((r) => buildUserProfile(r.id, req.dbUserId))),
  ]);

  res.json({
    yudates: yudates.items,
    users: users.filter(Boolean),
  });
});

export default router;
