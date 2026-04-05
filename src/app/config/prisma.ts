import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { logger } from "../../utils/logger";

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

const createPrismaClient = () => {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

  const client = new PrismaClient({
    adapter,
    log: [
      { level: "error", emit: "event" },
      { level: "warn", emit: "event" },
    ],
  });

  client.$on("error", (e: any) => {
    logger.error("Prisma error", { message: e.message, target: e.target });
  });

  client.$on("warn", (e: any) => {
    logger.warn("Prisma warning", { message: e.message, target: e.target });
  });

  return client;
};

const prisma = global.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  global.prisma = prisma;
}

export default prisma;