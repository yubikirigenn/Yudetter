import app from "./app";
import { logger } from "./lib/logger";

const rawPort = process.env["PORT"] || "6543";

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  // Keep-alive self-ping for Render free tier
  const appUrl = process.env.APP_URL;
  if (appUrl) {
    const intervalMs = 10 * 60 * 1000; // 10 minutes
    setInterval(() => {
      fetch(`${appUrl.replace(/\/$/, "")}/api/health`)
        .then((res) => {
          logger.info({ status: res.status, url: appUrl }, "Self-ping keep-alive successful");
        })
        .catch((err) => {
          logger.error({ err, url: appUrl }, "Self-ping keep-alive failed");
        });
    }, intervalMs);
    logger.info({ appUrl, intervalMs }, "Self-ping keep-alive initialized");
  }

  // Auto-delete background job to physically clean up expired yudates from DB
  const cleanupIntervalMs = 30 * 1000; // 30 seconds
  setInterval(async () => {
    try {
      const { db, yudatesTable } = await import("@workspace/db");
      const { lte } = await import("drizzle-orm");
      const now = new Date();
      const deletedRows = await db
        .delete(yudatesTable)
        .where(lte(yudatesTable.autoDeleteAt, now))
        .returning({ id: yudatesTable.id });
      
      if (deletedRows.length > 0) {
        logger.info({ count: deletedRows.length, ids: deletedRows.map(r => r.id) }, "Auto-deleted expired yudates successfully.");
      }
    } catch (err) {
      logger.error({ err }, "Error in auto-delete background job");
    }
  }, cleanupIntervalMs);
  logger.info({ cleanupIntervalMs }, "Auto-delete background job initialized");
});
