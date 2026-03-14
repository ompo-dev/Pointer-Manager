import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as {
  pointManagerAuthPrisma?: PrismaClient;
};

export const authPrisma =
  globalForPrisma.pointManagerAuthPrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.pointManagerAuthPrisma = authPrisma;
}
