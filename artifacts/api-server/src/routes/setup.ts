import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { getAuth } from "@clerk/express";
import { z } from "zod";
import { buildUserProfile } from "../lib/buildResponse";

const router = Router();

const SetupBody = z.object({
  username: z
    .string()
    .min(1, "ユーザーIDは1文字以上で入力してください")
    .max(30, "ユーザーIDは30文字以内で入力してください")
    .regex(/^[a-zA-Z0-9_]+$/, "ユーザーIDは半角英数字とアンダースコアのみ使用できます"),
  displayName: z.string().min(1, "表示名は1文字以上で入力してください").max(50),
  birthday: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "生年月日はYYYY-MM-DD形式で入力してください"),
});

// POST /users/setup - first-time profile setup
router.post("/users/setup", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  const verifiedClerkId = auth?.userId;
  if (!verifiedClerkId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const parsed = SetupBody.safeParse(req.body);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message ?? "入力内容が正しくありません";
    res.status(400).json({ error: firstError });
    return;
  }

  const [currentUser] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.clerkId, verifiedClerkId))
    .limit(1);

  if (!currentUser) {
    res.status(404).json({ error: "ユーザーが見つかりません。再度サインインしてください。" });
    return;
  }

  // Check username availability (exclude current user)
  const [taken] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.username, parsed.data.username))
    .limit(1);

  if (taken && taken.id !== currentUser.id) {
    res.status(409).json({ error: "このユーザーIDはすでに使われています" });
    return;
  }

  try {
    await db
      .update(usersTable)
      .set({
        username: parsed.data.username,
        displayName: parsed.data.displayName,
        birthday: parsed.data.birthday,
        setupComplete: true,
      })
      .where(eq(usersTable.id, currentUser.id));
  } catch (err: any) {
    // Unique constraint violation on username (race condition)
    if (err?.code === "23505") {
      res.status(409).json({ error: "このユーザーIDはすでに使われています" });
      return;
    }
    throw err;
  }

  const profile = await buildUserProfile(currentUser.id, currentUser.id);
  res.json(profile);
});

// GET /users/setup/check-username?username=...
router.get("/users/setup/check-username", async (req, res): Promise<void> => {
  const username = (req.query.username as string)?.trim();
  if (!username) {
    res.json({ available: false, error: "ユーザーIDを入力してください" });
    return;
  }
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    res.json({ available: false, error: "半角英数字とアンダースコアのみ使用できます" });
    return;
  }

  const auth = getAuth(req);
  const verifiedClerkId = auth?.userId;

  const [currentUser] = verifiedClerkId
    ? await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.clerkId, verifiedClerkId)).limit(1)
    : [null];

  const [taken] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.username, username))
    .limit(1);

  const available = !taken || (currentUser != null && taken.id === currentUser.id);
  res.json({ available, error: available ? null : "このユーザーIDはすでに使われています" });
});

export default router;
