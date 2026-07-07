# Yudetter（ゆでったー）

日本語SNS。投稿（ユデート）、リユデート、引用リユデートができる X/Twitter ライクなプラットフォーム。パステルグリーンUI。

## Run & Operate

- `pnpm --filter @workspace/yudetter run dev` — フロントエンド開発サーバー
- `pnpm --filter @workspace/api-server run dev` — APIサーバー（port 8080）
- `pnpm run typecheck` — 全パッケージの型チェック
- `pnpm run build` — 全パッケージビルド
- `pnpm --filter @workspace/api-spec run codegen` — OpenAPI spec から型・フックを再生成
- `pnpm --filter @workspace/db run push` — DBスキーマ変更の適用（dev のみ）

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite, Tailwind v4, Wouter, TanStack Query, Clerk Auth
- API: Express 5, Clerk middleware
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Auth: Replit-managed Clerk (email/password)

## Where things live

- `lib/api-spec/openapi.yaml` — APIコントラクトのSource of Truth
- `lib/db/src/schema/` — DBスキーマ（users, yudates, likes, reyudates, follows, notifications）
- `artifacts/api-server/src/routes/` — バックエンドルート
- `artifacts/api-server/src/lib/auth.ts` — requireAuth / optionalAuth ミドルウェア
- `artifacts/api-server/src/lib/buildResponse.ts` — UserProfile / Yudate レスポンスビルダー
- `artifacts/yudetter/src/` — フロントエンド（React）

## Architecture decisions

- **Clerk Auth**: Replit管理のClerkテナント。メールアドレス必須登録、ID+パスワードログイン
- **JIT user sync**: Clerk認証後、`POST /api/users/sync`でDBにユーザーを同期（clerkIdはサーバーのセッションから取得、リクエストボディは信頼しない）
- **Timeline strategy**: ログイン時はフォロー中ユーザー+自分のユデート。未ログインは全公開ユデート
- **Pagination**: cursor-based（id降順）。path paramを持つエンドポイントはfirst buildではcursorなし

## Terminology

- ユデート = post/tweet
- リユデート = repost/retweet
- 引用リユデート = quote post
- いいね = like

## User preferences

- UIはパステルグリーン
- 使い勝手はXを意識
- DM機能なし
- アカウント登録はメアド必須、ログインはID+パスワード

## Gotchas

- OpenAPIスキーマ変更後は必ず `codegen` を再実行すること
- path param + query param を両方持つエンドポイントはOrvalが `*Params` 型を生成し衝突するため、query param を省くか `components/schemas` 経由にする
- `lib/*` 変更後は `pnpm run typecheck:libs` を先に実行すること

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
- See the `clerk-auth` skill for auth setup and customization
