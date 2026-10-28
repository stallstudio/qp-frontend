import "dotenv/config";
import { defineConfig } from "prisma/config";

// Config Prisma de la base UTILISATEURS, la seule de Queue Park (Prisma 7 : l'URL
// de connexion CLI vit ici, plus dans le schéma). Les données des parcs viennent
// de l'API Dispatch.
//
// Usage via `--config prisma.user.config.ts` (voir scripts user:* du package.json).
export default defineConfig({
  schema: "prisma/user/schema.prisma",
  migrations: {
    path: "prisma/user/migrations",
  },
  datasource: {
    url: process.env.USER_DATABASE_URL,
    shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL,
  },
});
