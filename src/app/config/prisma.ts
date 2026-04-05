import { PrismaClient } from "@prisma/client";
import { logger } from "../../utils/logger";

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

const prisma =
  global.prisma ??
  new PrismaClient({
    log: [
      { level: "error", emit: "event" },
      { level: "warn", emit: "event" },
    ],
  });

// Event listeners
prisma.$on("error", (e: any) => {
  logger.error("Prisma error", { message: e.message, target: e.target });
});

prisma.$on("warn", (e: any) => {
  logger.warn("Prisma warning", { message: e.message, target: e.target });
});

// Save instance in development
if (process.env.NODE_ENV !== "production") {
  global.prisma = prisma;
}

export default prisma;