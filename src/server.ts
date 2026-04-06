import http, { Server } from "http";
import app from "./app";
import { bootstrapApp } from "./app/bootstrap";
import { config } from "./app/config";
import prisma from "./app/config/prisma";
import { logger } from "./utils/logger";

async function startServer() {
  const port = config.app.port || 3000;
  let server: Server;

  try {
    // ─────────────────────────────────────────────
    // 1. Bootstrap (DB, cache, etc.)
    // ─────────────────────────────────────────────
    await bootstrapApp();
    logger.info("✅ Application bootstrapped successfully");

    // ─────────────────────────────────────────────
    // 2. Create HTTP server
    // ─────────────────────────────────────────────
    server = http.createServer(app);

    // ─────────────────────────────────────────────
    // 3. Start listening
    // ─────────────────────────────────────────────
    server.listen(port, () => {
      logger.info(`🚀 NovaPay API running on http://localhost:${port}`);
    });

    // ─────────────────────────────────────────────
    // 4. Server timeout
    // ─────────────────────────────────────────────
    server.setTimeout(120000);

    /**
     * ─────────────────────────────────────────────
     * 5. Graceful Shutdown Handler
     * ─────────────────────────────────────────────
     */
    const shutdown = async (signal: string) => {
      logger.warn(`⚠️ ${signal} received. Shutting down gracefully...`);

      try {
        if (server) {
          server.close(() => {
            logger.info("✅ HTTP server closed");
          });
        }

        await prisma.$disconnect();
        logger.info("✅ Database disconnected");

        process.exit(0);
      } catch (err) {
        logger.error("❌ Error during shutdown", {
          error: (err as Error).message,
        });
        process.exit(1);
      }
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);

    /**
     * ─────────────────────────────────────────────
     * 6. Unhandled Errors
     * ─────────────────────────────────────────────
     */
    process.on("unhandledRejection", async (reason) => {
      logger.error("❌ Unhandled Rejection", { reason });

      await shutdown("unhandledRejection");
    });

    process.on("uncaughtException", async (error) => {
      logger.error("❌ Uncaught Exception", { error: error.message });

      await shutdown("uncaughtException");
    });

  } catch (error) {
    logger.error("❌ Failed to start server", {
      error: (error as Error).message,
    });

    await prisma.$disconnect();
    process.exit(1);
  }
}

startServer();