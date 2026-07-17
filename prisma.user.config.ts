import "dotenv/config";
import { defineConfig } from "prisma/config";

// Config Prisma DÉDIÉE à la base UTILISATEURS (Prisma 7 : l'URL de connexion CLI
// vit ici, plus dans le schéma). Fichier NOMMÉ (pas prisma.config.ts) pour ne pas
// interférer avec la génération du client de la base principale, qui utilise le
// schéma par défaut prisma/schema.prisma.
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
