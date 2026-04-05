import http, { Server } from "http";
import app from "./app";
import { bootstrapApp } from "./app/bootstrap";
import { config } from "./app/config";
import  prisma  from "./app/config/prisma";
import { logger } from "./utils/logger";

// Start server
async function startServer() {
  let server: Server;
  const port = config.app.port || 3000;
  try {
    await bootstrapApp();
    console.log("Database connected");

    const server = http.createServer(app);

    server.listen(port, () => {
console.log(`\n🚀 NovaPay API is running at http://localhost:${port}`);
    });

    server.setTimeout(120000);

    const exitHandler = () => {
      if (server) {
        server.close(() => {
          console.log(`Server closed gracefully.`);
          process.exit(1);
        });
      } else {
        process.exit(1);
      }
    };

    process.on("SIGTERM", exitHandler);
    process.on("SIGINT", exitHandler);

    // Handle unhandled promise rejections
    process.on("unhandledRejection", (error) => {
      console.log(
        "Unhandled Rejection is detected, we are closing our server...",
      );
      if (server) {
        server.close(() => {
          console.log(error);
          process.exit(1);
        });
      } else {
        process.exit(1);
      }
    });
  } catch (error) {
    logger.error('Failed to start server', { error: (error as Error).message });
    await prisma.$disconnect();
    process.exit(1);
  }
}
startServer();
