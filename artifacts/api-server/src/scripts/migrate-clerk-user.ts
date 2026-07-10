/**
 * 既存ユーザー（Clerk時代のアカウント）をBetter Auth形式に移行するスクリプト
 * Usage: npx tsx src/scripts/migrate-clerk-user.ts
 */
import { db, usersTable, accountsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { auth } from "../lib/better-auth.js";

async function main() {
  const email = "yubikirigenn@gmail.com";
  const temporaryPassword = "YudeteChangeMe2025!"; // 初期パスワード（後で変更してください）

  console.log(`\n=== Clerk → Better Auth ユーザー移行スクリプト ===\n`);
  console.log(`対象メール: ${email}`);

  // 1. usersテーブルにユーザーが存在するか確認
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email))
    .limit(1);

  if (!user) {
    console.log("❌ ユーザーが見つかりませんでした。");
    return;
  }

  console.log(`✅ ユーザー発見:`);
  console.log(`   ID: ${user.id}`);
  console.log(`   Username: ${user.username}`);
  console.log(`   DisplayName: ${user.displayName}`);

  // 2. accounts テーブルに credentialアカウントが既に存在するか確認
  const [existingAccount] = await db
    .select()
    .from(accountsTable)
    .where(eq(accountsTable.userId, user.id))
    .limit(1);

  if (existingAccount) {
    console.log(`\n⚠️  既にBetter Authアカウントが存在します:`);
    console.log(`   アカウントID: ${existingAccount.id}`);
    console.log(`   プロバイダー: ${existingAccount.providerId}`);
    console.log(`\n → 再生成するには既存アカウントを削除してからスクリプトを実行してください。`);
    return;
  }

  // 3. Better Auth のハッシュ化メソッドを使ってパスワードをハッシュ
  console.log(`\n🔐 パスワードをハッシュ化中...`);
  const hashedPassword = await auth.password.hash(temporaryPassword);

  // 4. accountsテーブルに credentialアカウントを挿入
  await db.insert(accountsTable).values({
    id: crypto.randomUUID(),
    accountId: email,
    providerId: "credential",
    userId: user.id,
    password: hashedPassword,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  // 5. users テーブルの name カラム（Better Auth標準）を埋める
  if (!user.name || user.name === "") {
    await db.update(usersTable)
      .set({
        name: user.displayName,
        emailVerified: true,
        updatedAt: new Date(),
      })
      .where(eq(usersTable.id, user.id));
    console.log(`✅ nameカラムを更新しました: ${user.displayName}`);
  }

  console.log(`\n✅ 移行完了！`);
  console.log(`\n以下の情報でログインできます:`);
  console.log(`   メール: ${email}`);
  console.log(`   パスワード: ${temporaryPassword}`);
  console.log(`\n⚠️  セキュリティのため、ログイン後にパスワードを変更してください。`);
}

main().catch(console.error).finally(() => process.exit(0));
