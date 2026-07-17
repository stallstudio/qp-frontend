# Comptes utilisateurs — Queue Park

Système de comptes **optionnel** : sans connexion, l'app fonctionne exactement
comme avant (favoris/thème/format en localStorage). Connecté, ces données sont
synchronisées entre appareils, et l'utilisateur peut créer des notifications de
temps d'attente.

## Architecture

### Deux bases de données

- **Base principale** (`DATABASE_URL`) — inchangée : parcs, attractions, temps
  d'attente, historiques, calendriers… Lue via `@/lib/prisma` (`getPrisma()`).
- **Base utilisateurs** (`USER_DATABASE_URL`) — nouvelle, isolée : comptes,
  préférences, favoris, notifications, historique, sessions, auth. Client Prisma
  dédié généré dans `lib/generated/user-client`, accédé via `@/lib/user-prisma`
  (`getUserPrisma()`).

Aucune clé étrangère entre les deux bases : favoris et notifications référencent
les attractions **par identifiant** (`rideId`, `parkIdentifier`). Les
notifications/l'historique stockent en plus un instantané du nom (affichage sans
jointure inter-bases).

Schéma : [`prisma/user/schema.prisma`](prisma/user/schema.prisma).

### Authentification (Auth.js v5, sans mot de passe)

- **Google OAuth** + **Magic link** par email (provider Resend).
- Sessions en base (`sessions`) via `@auth/prisma-adapter`.
- Config : [`auth.ts`](auth.ts) · route : `app/api/auth/[...nextauth]/route.ts`.
- Email magic link : [`emails/magic-link.tsx`](emails/magic-link.tsx) — réutilise
  l'architecture des templates de l'admin (react-email + Resend).

### Synchronisation (compte prime)

`components/providers/user-provider.tsx` :
- **Favoris** : localStorage reste la source de travail ; à la connexion, fusion
  (union) local ↔ compte, puis chaque changement est repoussé (le hook
  `useFavorites` est inchangé).
- **Préférences** : à la connexion, si le compte a déjà des préférences elles
  s'appliquent (multi-appareils) ; si le compte est vierge (`initialized=false`),
  les réglages locaux y sont poussés sans rien changer visuellement.

### Routes API (`app/api/user/*`)

| Route | Méthodes | Rôle |
|---|---|---|
| `me` | GET | Profil : préférences, favoris, compteurs |
| `preferences` | PATCH | Langue / thème / format horaire |
| `favorites` | GET, PUT | Lecture / remplacement complet |
| `favorites/merge` | POST | Union locale + compte (connexion) |
| `notifications` | GET, POST | Liste / création (**depuis une attraction**) |
| `notifications/[id]` | PATCH, DELETE | Activer/désactiver, supprimer |
| `notifications/history` | GET | Historique (lecture seule) |

### UI

- Bloc accueil : `components/home/user-block.tsx` (au-dessus des parcs favoris).
- Popup connexion/inscription : `components/auth/auth-dialog.tsx`.
- Page profil : `app/[locale]/profile/` + `components/profile/*`.
- **Création de notification uniquement** depuis la cloche d'une attraction
  (`components/notifications/create-notification-dialog.tsx`, branchée dans
  `wait-time-table.tsx`) — jamais depuis le profil.

Le **moteur** qui vérifie les temps et déclenche les notifications reste à écrire :
il lira `notifications` où `active=true` par `rideId` et écrira dans
`notification_history`. Toute la structure est prête.

## Mise en place

1. **Dépendances** : `npm install` (ajoute `next-auth`, `@auth/prisma-adapter`,
   `resend`, `@react-email/components`).
2. **Variables d'env** (voir `.env`) : `USER_DATABASE_URL`, `AUTH_SECRET`
   (`npx auth secret`), `AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET`, `RESEND_API_KEY`.
3. **Base utilisateurs** : créer la base (`CREATE DATABASE twts_users;`).
4. **Client Prisma** : `npm run user:generate` (utilise `prisma.user.config.ts`,
   config dédiée — Prisma 7 exige l'URL de connexion hors du schéma).
5. **Tables** : `npm run user:push` (recommandé — pas de shadow DB requise).
   Alternative avec migrations versionnées : `npm run user:migrate` (dev, nécessite
   `SHADOW_DATABASE_URL` ou le droit de créer une base) / `npm run user:deploy` (prod).
6. **Google** : OAuth Cloud Console, redirect URI
   `https://<domaine>/api/auth/callback/google`.
7. **Resend** : domaine `updates.queue-park.com` vérifié (expéditeur `login@`).

> **CI/Docker** : générer les DEUX clients avant `next build`
> (`prisma generate` pour la base principale **et** `npm run user:generate`).
