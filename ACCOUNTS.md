# Comptes utilisateurs — Queue Park

Système de comptes **optionnel** : sans connexion, l'app fonctionne exactement
comme avant (favoris/thème/format en localStorage). Connecté, ces données sont
synchronisées entre appareils, et l'utilisateur peut créer des alertes de temps
d'attente.

## Architecture

### Deux bases de données

- **Base principale** (`DATABASE_URL`) — inchangée : parcs, attractions, temps
  d'attente, historiques, calendriers… Lue via `@/lib/prisma` (`getPrisma()`).
- **Base utilisateurs** (`USER_DATABASE_URL`) — nouvelle, isolée : comptes,
  préférences, favoris, alertes, historique, abonnements push, sessions, auth.
  Client Prisma dédié généré dans `lib/generated/user-client`, accédé via
  `@/lib/user-prisma` (`getUserPrisma()`).

Aucune clé étrangère entre les deux bases : favoris et alertes référencent les
attractions **par identifiant** (`rideId`, `parkIdentifier`). Les alertes /
l'historique stockent en plus un instantané du nom (affichage sans jointure
inter-bases).

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
| `alerts` | GET, POST | Liste / création (**depuis une attraction**) |
| `alerts/[id]` | PATCH, DELETE | Activer/désactiver, modifier le seuil, supprimer |
| `alerts/history` | GET | Historique (lecture seule) |
| `push` | POST, DELETE | Abonnement Web Push de l'appareil |

### UI

- Bloc accueil : `components/home/user-block.tsx` (au-dessus des parcs favoris).
- Popup connexion/inscription : `components/auth/auth-dialog.tsx`.
- Page profil : `app/[locale]/profile/` + `components/profile/*` (onglets
  Alertes / Préférences ; le seuil est modifiable ici).
- **Création d'alerte uniquement** depuis l'œil d'une attraction
  (`components/parks/attraction-detail/alert-section.tsx`) — jamais depuis le profil.

Le **moteur** qui vérifie les temps et déclenche les alertes est **branché**
(voir la section « Alertes Web Push » d'`AI_CONTEXT.md`) :
`GET /api/cron/alerts` (protégé par `ALERTS_CRON_SECRET`, appelé par une Dokploy
Schedule) lit `alerts` `active=true` par `rideId`, compare au temps standby
courant de la base principale, envoie un Web Push (VAPID) aux `push_subscriptions`
de l'utilisateur quand `waitTime ≤ threshold`, et écrit dans `alert_history`
(anti-spam via `Alert.armed`, expiration quotidienne via `Alert.activeDate`).

## Mise en place

1. **Dépendances** : `npm install` (ajoute `next-auth`, `@auth/prisma-adapter`,
   `resend`, `@react-email/components`, `web-push`).
2. **Variables d'env** (voir `.env`) : `USER_DATABASE_URL`, `AUTH_SECRET`
   (`npx auth secret`), `AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET`, `RESEND_API_KEY`.
   **Alertes push** : `npm run vapid:generate` puis renseigner
   `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, et
   `ALERTS_CRON_SECRET` ; enfin créer la Dokploy Schedule qui appelle
   `GET /api/cron/alerts?key=$ALERTS_CRON_SECRET` (~1-2 min).
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
