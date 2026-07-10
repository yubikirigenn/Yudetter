import express, { type Express } from "express";
import path from "path";
import cors from "cors";
import pinoHttp from "pino-http";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./lib/better-auth";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(cors({ credentials: true, origin: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Better Auth ハンドラーをマウント
app.use("/api/auth", toNodeHandler(auth));

app.use("/api", router);

// Chrome DevToolsのデバッグ用自動リクエストを正常終了させてコンソールエラーを抑制
app.get("/.well-known/appspecific/com.chrome.devtools.json", (req, res) => {
  res.setHeader("Content-Security-Policy", "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:;");
  res.json({});
});


// Serve frontend static assets from public/ folder
const publicPath = path.resolve(globalThis.__dirname || ".", "../../yudetter/dist/public");
app.use(express.static(publicPath));

// Serve uploaded images statically from project root uploads folder
const uploadsPath = path.resolve(globalThis.__dirname || ".", "../../uploads");
app.use("/uploads", express.static(uploadsPath));

app.use((req, res, next) => {
  if (req.path.startsWith("/api")) {
    return next();
  }
  res.sendFile(path.join(publicPath, "index.html"), (err) => {
    if (err) {
      next();
    }
  });
});

// Global JSON error handler for API routes
app.use((err: any, req: any, res: any, next: any) => {
  logger.error({ err }, "Unhandled API error");
  
  if (res.headersSent) {
    return next(err);
  }

  const statusCode = err.status || err.statusCode || 500;
  res.status(statusCode).json({
    error: err.message || "サーバー内部エラーが発生しました。"
  });
});

export default app;
