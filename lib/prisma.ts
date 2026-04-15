import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const getPrisma = (): PrismaClient => {
  if (!globalForPrisma.prisma) {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error("DATABASE_URL is not defined");
    }

    const url = new URL(databaseUrl);
    const adapter = new PrismaMariaDb({
      host: url.hostname,
      port: parseInt(url.port || "3306"),
      user: url.username,
      password: decodeURIComponent(url.password),
      database: url.pathname.slice(1),
      connectionLimit: 10, // Réduit pour éviter saturation
    });

    globalForPrisma.prisma = new PrismaClient({
      adapter,
      log:
        process.env.NODE_ENV === "development"
          ? ["query", "error", "warn"]
          : ["error"],
    });
  }
  return globalForPrisma.prisma;
};

// Préserver l'instance en développement
if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = globalForPrisma.prisma;
}

export const disconnectDatabase = async (): Promise<void> => {
  if (globalForPrisma.prisma) {
    await globalForPrisma.prisma.$disconnect();
    globalForPrisma.prisma = undefined;
  }
};
