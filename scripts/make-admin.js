/**
 * Bascule le drapeau `isAdmin` d'un compte du SITE PUBLIC (base utilisateurs).
 *
 *   npm run make-admin -- personne@exemple.com          # accorde
 *   npm run make-admin -- personne@exemple.com --off    # retire
 *
 * Il n'y a pas d'interface pour ça : l'admin panel vit sur l'AUTRE base
 * (DATABASE_URL) et n'a aucune connexion vers celle-ci. Le compte doit déjà
 * exister, c'est-à-dire s'être connecté au moins une fois sur le site — Auth.js
 * crée la ligne `users` à la première connexion, pas avant.
 *
 * En CommonJS et sans dotenv : le paquet racine n'est pas `type: module` et
 * n'embarque ni `tsx` ni `dotenv`. L'environnement vient de `--env-file=.env`
 * (Node ≥ 20), posé dans le script npm.
 *
 * ⚠️ `.env` pointe sur la PRODUCTION : ce script y écrit directement.
 */

const { PrismaMariaDb } = require("@prisma/adapter-mariadb");
const { PrismaClient } = require("../lib/generated/user-client");

async function main() {
  const args = process.argv.slice(2);
  const off = args.includes("--off");
  const email = args.find((arg) => !arg.startsWith("--"));

  if (!email) {
    console.error(
      "Usage: npm run make-admin -- <email> [--off]\n" +
        "  --off  retire le droit au lieu de l'accorder",
    );
    process.exit(1);
  }

  const databaseUrl = process.env.USER_DATABASE_URL;
  if (!databaseUrl) {
    console.error(
      "USER_DATABASE_URL est absent. Lancer via `npm run make-admin` (qui passe --env-file=.env).",
    );
    process.exit(1);
  }

  // Même construction d'adapter que lib/user-prisma.ts.
  const url = new URL(databaseUrl);
  const adapter = new PrismaMariaDb({
    host: url.hostname,
    port: parseInt(url.port || "3306"),
    user: url.username,
    password: decodeURIComponent(url.password),
    database: url.pathname.slice(1),
    connectionLimit: 1,
  });
  const prisma = new PrismaClient({ adapter, log: ["error"] });

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, name: true, isAdmin: true },
    });

    if (!user) {
      console.error(
        `Aucun compte pour « ${email} » sur ${url.hostname}${url.pathname}.\n` +
          "Se connecter une fois sur le site avec cette adresse crée le compte.",
      );
      process.exitCode = 1;
      return;
    }

    const isAdmin = !off;
    if (user.isAdmin === isAdmin) {
      console.log(
        `${email} est déjà ${isAdmin ? "admin" : "un compte normal"} — rien à faire.`,
      );
      return;
    }

    await prisma.user.update({ where: { id: user.id }, data: { isAdmin } });
    console.log(
      `${email} ${isAdmin ? "est désormais ADMIN" : "n'est plus admin"} ` +
        `(base ${url.hostname}${url.pathname}).`,
    );
    if (isAdmin) {
      console.log(
        "La session est relue en base à chaque requête : le changement prend " +
          "effet sans reconnexion.",
      );
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
