import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@/lib/generated/user-client";

// Client Prisma de la base UTILISATEURS, la seule base de Queue Park : les
// données des parcs viennent de l'API Dispatch (`lib/dispatch.ts`). Adapter
// MariaDB construit depuis une URL.

const globalForUserPrisma = globalThis as unknown as {
  userPrisma: PrismaClient | undefined;
};

export const getUserPrisma = (): PrismaClient => {
  if (!globalForUserPrisma.userPrisma) {
    const databaseUrl = process.env.USER_DATABASE_URL;
    if (!databaseUrl) {
      throw new Error("USER_DATABASE_URL is not defined");
    }

    const url = new URL(databaseUrl);
    const adapter = new PrismaMariaDb({
      host: url.hostname,
      port: parseInt(url.port || "3306"),
      user: url.username,
      password: decodeURIComponent(url.password),
      database: url.pathname.slice(1),
      connectionLimit: 5,
    });

    globalForUserPrisma.userPrisma = new PrismaClient({
      adapter,
      log:
        process.env.NODE_ENV === "development"
          ? ["query", "error", "warn"]
          : ["error"],
    });
  }
  return globalForUserPrisma.userPrisma;
};
