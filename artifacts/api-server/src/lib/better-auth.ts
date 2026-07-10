import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { db, usersTable, sessionsTable, accountsTable, verificationsTable } from "@workspace/db";
import { multiSession } from "better-auth/plugins";
import crypto from "crypto";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: usersTable,
      session: sessionsTable,
      account: accountsTable,
      verification: verificationsTable,
    },
  }),
  plugins: [
    multiSession(),
  ],
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          const u = user as any;
          const finalData = { ...u, yudedollar: 1000 };
          // username が未設定（Googleログインなど）の場合、仮のユーザーIDを生成
          if (!u.username) {
            const emailPrefix = (u.email as string)
              .split("@")[0]
              .replace(/[^a-zA-Z0-9_]/g, "_")
              .slice(0, 14);
            const tempUsername = `${emailPrefix}_${Date.now().toString(36)}`;
            finalData.username = tempUsername.slice(0, 20);
            finalData.displayName = u.name || u.email.split("@")[0];
            finalData.setupComplete = false;
          }
          return { data: finalData };
        },
        after: async (user) => {
          try {
            const { db, ydTransactionsTable } = await import("@workspace/db");
            await db.insert(ydTransactionsTable).values({
              userId: Number(user.id),
              amount: 1000,
              type: "welcome",
              description: "新規登録ウェルカムボーナス",
            });
          } catch (e) {
            console.error("Failed to insert welcome bonus transaction", e);
          }
        }
      },
    },
  },
  user: {
    additionalFields: {
      username: {
        type: "string",
        required: false,
      },
      displayName: {
        type: "string",
        required: false,
      },
      bio: {
        type: "string",
        required: false,
      },
      avatarUrl: {
        type: "string",
        required: false,
      },
      headerUrl: {
        type: "string",
        required: false,
      },
      birthday: {
        type: "string",
        required: false,
      },
      setupComplete: {
        type: "boolean",
        required: false,
      },
      yudedollar: {
        type: "number",
        required: false,
      },
      badgeType: {
        type: "string",
        required: false,
      },
      lastLoginDate: {
        type: "string",
        required: false,
      },
      consecutiveLoginDays: {
        type: "number",
        required: false,
      },
      rankingOptIn: {
        type: "boolean",
        required: false,
      },
    },
  },
  advanced: {
    database: {
      generateId: (options) => {
        if (options.model === "user" || options.model === "users") {
          return undefined as any;
        }
        return crypto.randomUUID();
      },
    },
  },
});
export type Auth = typeof auth;
