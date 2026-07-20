# AI_CONTEXT — qp-frontend

> Fiche de contexte pour l'assistant IA. But : comprendre le projet sans relire
> tout le code. À maintenir à jour quand l'architecture change.
> Dernière mise à jour : 2026-07-20.

## En un mot

Frontend **Queue Park** (https://queue-park.com) : site public affichant les
**temps d'attente en direct** de +100 parcs d'attractions, leurs **spectacles**,
**horaires** et **statuts**. Consomme les données produites par le worker
`tw-waittimes-worker` (même base MySQL, lue via Prisma).

## Stack

- **Next.js 15** (App Router, `--turbopack`), **React 19**, **TypeScript**.
- **Tailwind CSS v4** (config dans `app/globals.css`, pas de `tailwind.config`).
- **next-intl v4** pour l'i18n (14 langues, defaultLocale `fr`, préfixe d'URL
  toujours présent).
- **Prisma 7** + **MariaDB/MySQL** (adapter `@prisma/adapter-mariadb`) — le
  frontend **lit** la base partagée avec le worker.
- **radix-ui** + composants maison type shadcn dans `components/ui/`.
- `lucide-react` (icônes), `luxon` (dates/timezones), `axios`, `sonner` (toasts),
  `next-themes` (dark mode), `motion`, `react-hook-form` + `zod`-like resolvers.
- `recharts` (+ wrapper shadcn `components/ui/chart.tsx`) : uniquement pour le
  graphique du popup « détail attraction » (`wait-time-chart.tsx`).

## Arborescence clé

```
app/
  [locale]/
    layout.tsx        # NextIntlClientProvider + TimeFormatProvider + metadata
    page.tsx          # Accueil (client) : header, recherche, favoris, populaires, liste
    about/page.tsx    # Page À propos (server -> AboutPageClient) [AJOUTÉE]
    park/[parkIdentifier]/  # Page d'un parc
  api/
    parks/route.ts              # GET liste des parcs + parcs populaires
    park/[parkId]/route.ts      # GET données live d'un parc (waitTimes, shows, horaires)
    park/[parkId]/history/route.ts # GET historique du jour (pour sparklines/tendances)
    report/route.ts             # POST signalement de problème
  globals.css        # Thème Tailwind v4, animations (shine, border-beam, etc.)
components/
  home/              # header (hero scroll-shrink), popular-parks, favorite-parks, parks-list, search
  parks/             # header, main-card (container à onglets), wait-time-table,
                     # show-time-table, wait-trend (flèches), cover-image, opening-hours...
  about/             # vignette.tsx, demos.tsx, about-page-client.tsx [AJOUTÉ]
  ui/                # primitives (card, tabs, button, footer, favorite-star, table...)
  search/ providers/ theme-provider
hooks/               # useFavorites, useAutoRefresh, usePageVisibility, useTimeFormat, useWaitTimeChanges
i18n/                # routing.ts (locales), request.ts (chargement messages + fallback EN)
lib/                 # badge.tsx (pastilles temps/statut), prisma.ts, wait-times.ts,
                     # show-times.ts, opening-hours.ts, ip-rules.ts, utils.ts, report-config.ts
messages/            # <locale>.json (fr et en = sources complètes ; autres langues)
types/               # api.ts, waitTime.ts, show.ts, openingHour.ts, park.ts, group.ts
```

## i18n — important

- 14 locales : `en, fr, de, ja, es, nl, it, ko, vi, sv, pl, zh, da, pt`.
- `defaultLocale = "fr"`, `localePrefix: "always"` → toutes les URLs sont
  `/{locale}/...`.
- **Chargement** (`i18n/request.ts`) : merge peu profond `{ ...en, ...locale }`.
  Donc **tout namespace absent d'une langue retombe sur l'anglais** au lieu
  d'afficher une clé manquante. Conséquence pratique : un nouveau namespace peut
  n'être écrit qu'en `fr.json` + `en.json`, les autres langues afficheront
  l'anglais tant qu'elles ne sont pas traduites.
- Navigation localisée : importer `Link`, `useRouter`, `usePathname`,
  `redirect` depuis `@/i18n/routing` (pas `next/link`) pour préserver la locale.

## Flux de données

1. Le **worker** remplit la base (parcs, rides, wait_times, shows, opening_hours…).
2. Les **routes API** du frontend lisent cette base via Prisma (`lib/prisma.ts`
   → `getPrisma()`), pas d'appel HTTP au worker.
3. Les **composants clients** (`page.tsx`, `park-page-client.tsx`) appellent ces
   routes via `axios` et gèrent l'auto-refresh (~60 s).

### Parcs populaires

Calculés dans `api/parks/route.ts` : `apiRequestLog.groupBy(parkId)` sur les
**2 dernières heures**, statut 200, IP non whitelistées, top 8 → 6 affichés.
C'est donc un classement par **nombre de consultations récentes**.

### Temps d'attente & files

- `types/waitTime.ts` : `WaitTime` a un tableau `queues: QueueTime[]`.
- `QueueTime.type` : `standby` (file classique, affichée par défaut) + files
  secondaires `fastlane`, `singlerider`, `virtualqueue` (dépliables au clic).
- Statuts (`WaitTimeStatus`) : `open | closed | down | maintenance` (+
  indisponible quand `waitTime < 0`). Pastilles dans `lib/badge.tsx`.
- Couleurs temps : ≤20 vert, ≤40 orange, >40 rouge ; `91` s'affiche `+90 min`.
- `wait-time-table.tsx` n'est **plus une `<table>`** : lignes en `<div>` avec
  une grille partagée `grid-cols-[4fr_1fr_1fr]` (en-tête + lignes alignés).
  Chaque attraction est un bloc `motion.div layout` (`motion/react`) → le
  reclassement (tri, favoris épinglés, changements de temps) **glisse** au lieu
  de sauter. `motion` n'est utilisé QUE là et dans les démos À propos + border-beam.

### Spectacles

- `components/parks/show-time-table/` : timeline horizontale (colonne de noms +
  créneaux positionnés). États visuels d'un créneau (voir `timeline-row.tsx`) :
  **terminé** = `bg-muted/50` grisé, **en cours** = `bg-primary/10` bordure
  pointillée, **à venir** = `bg-primary/20` bordure pleine. Une **légende**
  (namespace i18n `shows.legend*`) est rendue sous la timeline sur chaque page.

### Flèches de tendance (`components/parks/wait-trend.tsx`)

Compare le temps courant à la 1re valeur d'une fenêtre des 5 derniers points
d'historique connus (ignore les `-1`). Seuil `±5 min` : hausse (rouge ↗),
baisse (verte ↘), stable (gris →). Rien si indispo ou historique vide.

> **⏸️ SUSPENDU (temporaire).** L'historique et les tendances sont désactivés
> pour l'instant, **code conservé** (rien de supprimé), réactivables via des
> drapeaux :
> - `HISTORY_ENABLED` dans `park-page-client.tsx` : à `false`, `fetchHistory`
>   sort immédiatement → **aucune requête** vers `/api/park/:id/history`.
> - `TRENDS_ENABLED` dans `wait-time-table.tsx` : à `false`, les flèches ne sont
>   jamais rendues (le composant `WaitTrend` et son branchement restent en
>   place). Le prop `parkClosed` (masquage quand parc fermé) reste, en aval.
> - La carte « tendance » du **guide À propos** (`about-page-client.tsx`) est
>   **commentée** (imports `TrendingUp` / `TrendDemo` commentés aussi).
>
> Pour réactiver : repasser les deux drapeaux à `true` et décommenter la
> vignette + ses imports.

### Favoris (`hooks/useFavorites.ts`)

`localStorage` = source de travail (même connecté ; le `UserProvider` miroite avec
le compte). Namespaces isolés (`"parks"`, `"rides"`). SSR-safe (hydratation après
montage), synchronisé entre onglets (`storage`) et instances (`qp-fav-change`).
Les favoris sont épinglés en tête des listes. Dans `wait-time-table.tsx`, le
groupe des favoris est encadré de deux séparateurs ondulés ambrés
(`components/ui/wavy-divider.tsx`), celui du haut portant le libellé
`favorites.yours` (« Vos favoris »).

- **Plafond parcs = 20** (`PARK_FAVORITES_LIMIT`/`FAV_LIMITS` dans
  `lib/favorites-storage.ts`). `useFavorites().toggle` renvoie un **booléen**
  (`false` si l'ajout dépasse le plafond ; le retrait n'est jamais bloqué) — les
  boutons étoile parc (`park-card.tsx`, `parks/header.tsx`) affichent un toast si
  refusé. La synchro descendante depuis le compte n'est **pas** tronquée.
- **Accueil** (`components/home/favorite-parks.tsx`) : au-delà de 9 parcs (= 3×3),
  8 cartes + tuile « Voir les N autres » ; le reste se **déroule vers le bas**
  (hauteur 0→auto via `motion`) et se replie vers le haut.
- **Popup profil** (`components/profile/favorites-popup.tsx`, `scope` parcs|rides) :
  ouvert depuis les vignettes du profil. Les clés (identifiants) sont résolues en
  noms via `POST /api/user/favorites/resolve` (base principale) — rond de
  chargement pendant la résolution. Attractions **groupées par parc** (en-têtes de
  section), retrait au clic sur l'étoile (ligne qui « part », animation fluide).

### Popup « détail attraction » (`components/parks/attraction-detail/`)

Chaque ligne d'attraction a une icône **œil** à droite (à côté du chevron
d'expand) qui ouvre `attraction-detail-dialog.tsx` (plus d'étoile/cloche dans la
liste). Le popup empile des sections : image (placeholder `CameraOff`), favoris
(`favorite-section.tsx`), alertes (`alert-section.tsx`), graphique
du jour + prévision (`chart-section.tsx` → `wait-time-chart.tsx`), et Thrills
(`thrills-section.tsx`, lien placeholder vers thrills.world).

> **Terminologie** : côté produit/UI on parle d'**alertes** (« créer une
> alerte », namespace i18n `alerts`, modèles `Alert`/`AlertHistory`, routes
> `/api/user/alerts`, `/api/cron/alerts`). On garde **push/notification** UNIQUEMENT
> pour la couche navigateur (permission « notifications », `PushSubscription`,
> `/api/user/push`, `hooks/usePushNotifications`, service worker, VAPID).

- **Alertes : desktop dans l'onglet, mobile après installation.**
  `alert-section.tsx` applique la matrice via `hooks/usePwaInstall.ts`
  (+ `lib/pwa.ts`, singleton qui capte `beforeinstallprompt`/`appinstalled` et
  détecte standalone/plateforme). Le Web Push marche dans l'onglet sur **desktop**
  (Chrome/Edge/Firefox/Safari) et Android Chrome ; seul **iOS** l'impose en PWA.
  Choix produit retenu : **desktop → formulaire direct** ; **mobile non installé
  (iOS/Android) → écran d'installation** (bouton si `beforeinstallprompt`, sinon
  instructions iOS/Android) ; non connecté → CTA connexion (`AuthDialog`) ;
  connecté (desktop, ou PWA mobile) → stepper (édition du seuil aussi possible
  depuis le profil) + voir/modifier/supprimer (routes `/api/user/alerts`). Les
  seuils sont une **séquence non uniforme** `0, 1, 5, 10, 15 … 120`
  (`lib/alert-thresholds.ts`) : `number-stepper.tsx` accepte un prop `values`
  (navigation par index) en plus du mode `min/max/step`. Défaut d'une NOUVELLE
  alerte = **le cran juste sous le temps actuel** de l'attraction
  (`defaultThresholdForWait`, ex. 35→30, 5→1, 1→0 ; repli 20 si fermé/indispo).
  i18n : namespaces `attractionDetail` +
  `alerts` (fr+en). **Livraison = Web Push réel** (voir bloc dédié
  plus bas) : au clic « Enregistrer », `hooks/usePushNotifications.ts` demande la
  permission + abonne l'appareil (`lib/push-client.ts`) et persiste l'abonnement
  via `POST /api/user/push` ; permission refusée → la notif est quand même
  enregistrée (autres appareils), avec un avertissement (`pushBlocked`/`pushDenied`).
- **Graphique/prévision** : endpoint dédié `GET /api/park/[parkId]/ride/[rideId]/history`
  (fetché à la demande, **indépendant** de l'historique global suspendu).
  `lib/wait-times-history.ts` reconstruit les séries horodatées depuis le modèle
  temporel `wait_times` (today + N jours) ; `lib/wait-times-forecast.ts` (module
  **pur**, interface `ForecastStrategy` extensible, v1 `profile-trend-v1` =
  profil médian des jours précédents × échelle du jour + raccord tendance).

## Conventions

- Composants avec état/hooks/browser → `"use client"`. Pages `page.tsx` de route
  = server components qui exportent `generateMetadata` puis rendent un client.
- `cn()` (`lib/utils`) = clsx + tailwind-merge ; passer des classes qui écrasent
  les défauts (ex. `Card` a `py-6 gap-6 rounded-xl`, surchargeable).
- Le « container temps d'attente » = `components/parks/main-card.tsx` : `Card`
  arrondie `rounded-4xl` avec `Tabs` et une pastille coulissante iOS-like.
  La page À propos réutilise ce motif.
- Commentaires du code en français, orientés « pourquoi ».

## Pas de node/npm dans le shell agent

`node`, `npm`, `npx` ne sont pas sur le PATH du shell non-interactif. Éviter de
lancer build/tsc ici ; se fier à la revue manuelle (le repo compile côté user).

## Page À propos (ajout 2026-07)

- Route `app/[locale]/about/page.tsx` (metadata via namespace `about`).
- `components/ui/scroll-shrink-header.tsx` : **en-tête fixe scroll-shrink**
  générique et RÉUTILISABLE (spacer + carte `fixed` qui rétrécit, titre qui glisse
  au centre, lien de retour qui se fond). Libellés en props (`title`, `subtitle`,
  `backLabel`, `backHref`). `components/about/about-header.tsx` n'est plus qu'un
  mince wrapper qui lui passe les strings du namespace `about` ; la **page profil**
  l'utilise aussi (mêmes strings depuis `profile`).
- `components/about/about-page-client.tsx` : hero + `Card` à **2 onglets**
  (`about` = le projet, `guide` = les fonctionnalités), grilles de `Vignette`.
- `components/about/vignette.tsx` : petite carte (icône + titre + texte + démo).
- `components/about/demos.tsx` : mini-démos **vivantes** réutilisant les vrais
  composants (`WaitTrend`, `FavoriteStar`, badges) — pas d'images statiques.
- Contenu i18n sous le namespace `about` dans `fr.json` + `en.json` (fallback EN
  pour les autres langues).
- **Footer** (`components/ui/footer.tsx`) : rangée de boutons dans l'ordre
  **compte, À propos, langue, thème**. Le compte = `components/ui/footer-auth.tsx`
  (client) : connecté → lien `/profile` (avatar + « Profil ») ; sinon → bouton
  d'auth ouvrant `AuthDialog`. Le « | » ne sépare plus que les **catégories**
  (compte/nav vs préférences).

## Comptes utilisateurs (ajout 2026-07) — **optionnel**

Détails complets : [`ACCOUNTS.md`](ACCOUNTS.md). En bref :

- **2ᵉ base de données** dédiée aux comptes (`USER_DATABASE_URL`), séparée de la
  base principale. Client Prisma isolé : schéma `prisma/user/schema.prisma` →
  généré dans `lib/generated/user-client`, accédé via `lib/user-prisma.ts`
  (`getUserPrisma()`). Références aux attractions **par id**, pas de FK inter-bases.
- **Auth.js v5** (`auth.ts`, route `app/api/auth/[...nextauth]`) : Google +
  magic link (provider Resend, email `emails/magic-link.tsx` calqué sur l'admin).
  Sessions en base. Helpers d'API : `lib/auth-helpers.ts` (`requireUserId`).
  **Fusion des comptes par email** (`allowDangerousEmailAccountLinking: true` sur
  Google) : un compte créé par magic link puis reconnecté via Google reste le
  MÊME compte. Un callback `signIn` **complète** alors `name`/`image` manquants
  depuis le profil Google (Auth.js ne les renseigne qu'à la création).
- **Providers** (dans `app/[locale]/layout.tsx`, sous `TimeFormatProvider`) :
  `session-provider.tsx` (Auth.js) + `user-provider.tsx`. Le `UserProvider`
  synchronise **favoris** (localStorage reste la source ; fusion à la connexion,
  push à chaque changement — `useFavorites` inchangé) et **préférences**
  (compte prime ; toute modif locale de thème/langue/format est reflétée au
  compte sans coupler les composants concernés).
- **Routes** `app/api/user/*` : `me`, `preferences`, `favorites` (+`/merge`),
  `alerts` (+`/[id]`, `/history`), `push`.
- **UI** : bloc accueil `components/home/user-block.tsx` (au-dessus des favoris),
  popup `components/auth/auth-dialog.tsx`, page `app/[locale]/profile/` +
  `components/profile/*`. La **page profil est calquée sur la page À propos**
  (header `ScrollShrinkHeader` partagé + carte à onglets `rounded-4xl` : onglets
  Alertes / Préférences). En tête : **3 vignettes** cliquables (parcs favoris
  `x/20`, attractions favorites, alertes actives) → popups favoris. Les blocs
  « Alertes actives » et « Historique » sont dans des **containers** (icône + titre,
  style vignette À propos). Squelette : `components/profile/profile-skeleton.tsx`
  (affiché tant que la session charge). La **création** d'alerte reste réservée au
  popup « détail attraction » ; le profil permet de **modifier le seuil**,
  (dé)activer et supprimer.
- **`AuthDialog` fusionné** : connexion et inscription = un seul flux passwordless,
  donc plus de prop `mode` — libellé neutre unique (`auth.title`/`auth.subtitle`).
- **Historique des alertes** (`components/profile/alert-history-section.tsx`) :
  **sondage** tant que la page est ouverte (nouvelle alerte animée en direct),
  nom du parc affiché, format `≤ {seuil} min`, **rétention 30 jours** (filtré côté
  serveur dans `/api/user/alerts/history`, avec texte d'info sous la liste).
- i18n : namespaces `userBlock`, `auth`, `profile`, `alerts` (fr+en).
## Divers (2026-07-20)

- **Manifest PWA localisé par langue** : route dynamique
  `app/[locale]/manifest.webmanifest/route.ts` (`force-static` + `generateStaticParams`
  sur les locales) servant un manifeste traduit (namespace i18n `manifest`,
  `name`/`description`/raccourcis, `lang`/`start_url` cohérents). Le
  `<link rel="manifest">` est posé par `generateMetadata` du layout
  (`manifest: /${locale}/manifest.webmanifest`). Seuls fr+en traduits (repli EN).
- **Préférences — concurrence** : `PATCH /api/user/preferences` fait un **seul
  `upsert`** avec **retry** sur l'erreur MariaDB « Record has changed since last
  read » (déclenchée par des changements de langue rapprochés qui enchaînent les
  requêtes). Le dernier écrit gagne.
- **Graphique — barres d'indispo** : `wait-time-chart.tsx` colore les plages sans
  temps réel (rouge fermé/maintenance, orange en panne, **gris = indisponible**) ;
  au survol, tooltip du statut (le gris affiche `attractionStatus.unavailable`).
- **Client Prisma user** : les modèles `Alert`/`AlertHistory`/`PushSubscription`
  doivent être **générés** (`npm run user:generate`) — un client périmé rend
  `prisma.alert` `undefined` et casse `/api/user/me`, le profil et le moteur.

## Alertes Web Push (moteur — ajout 2026-07)

Le système d'alertes est branché de bout en bout : créer une alerte écrit une
ligne QUE le moteur lit et transforme en push réel. (Domaine = **alerte** ; couche
livraison navigateur = **push/notification**.)

- **Abonnement (client)** : `lib/push-client.ts` (register `public/sw.js`,
  `PushManager.subscribe`, conversion clé VAPID) + `hooks/usePushNotifications.ts`
  (support/permission/abonné + `subscribe`/`unsubscribe`). Abonnement persistant
  par appareil dans le modèle **`PushSubscription`** (base user), via
  `POST /api/user/push` (upsert par `endpoint`) et `DELETE /api/user/push`.
- **Service worker** `public/sw.js` : UNIQUEMENT le push (`push` →
  `showNotification`, `notificationclick` → focus/ouverture de l'URL du parc).
  Pas de cache offline volontairement. Enregistré à la demande (au 1er abonnement).
- **Moteur** `app/api/cron/alerts/route.ts` (`GET`, protégé par
  `ALERTS_CRON_SECRET`) : déclenché ~toutes les 1-2 min par une **Dokploy
  Schedule** (comme le fetch des temps du worker). Il lit les alertes `active`
  (base user), lit les temps standby courants par `rideId` (base principale,
  `endTime: null`), et **alerte quand `waitTime ≤ threshold` sur une attraction
  ouverte**. Anti-spam par **déclenchement sur front** : drapeau `Alert.armed`
  (désarmé après envoi, réarmé quand le temps repasse au-dessus de
  `seuil + REARM_MARGIN=5`). Écrit `alert_history`, purge les endpoints morts (410/404).
  **Regroupement par utilisateur** : si plusieurs attractions passent sous leur
  seuil dans le même passage, une seule notif « digest » listée est envoyée (pas
  une par attraction) — l'historique/désarmement restent par alerte.
- **Expiration quotidienne** : une alerte ne vaut QUE pour le jour de sa
  (ré)activation. `Alert.activeDate` est (re)calé sur « maintenant » à la création
  / réactivation / changement de seuil ; le moteur **désactive** (`active=false`)
  toute alerte dont ce jour — évalué dans le **fuseau du parc** (jointure
  `ride → park.timezone`) — est antérieur à aujourd'hui.
- **Édition depuis le profil** : `components/profile/alerts-section.tsx` permet de
  **modifier le seuil** (stepper, `PATCH` debouncé) en plus de (dé)activer /
  supprimer. La création reste réservée au popup d'attraction.
- **Web Push (serveur)** `lib/web-push.ts` (VAPID via `web-push`), messages
  localisés par `lib/alert-messages.ts` (fr/en, repli EN — pas de next-intl dans
  un job de fond). Titre **aléatoire + emoji** (convivial, non redondant), corps
  factuel **sans nom de parc** (la personne est déjà dans le parc, et l'OS ajoute
  déjà « Queue Park » au titre) ; forme **digest** listée si plusieurs attractions.
  Clés : `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (client), `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`.

> **Mise en service** (une fois) : `npm install` (ajoute `web-push`), générer les
> clés `npm run vapid:generate` → remplir le `.env`, appliquer le schéma à la base
> user (`npm run user:push` — pas de shadow DB requise, puis `user:generate`), et
> créer la Dokploy Schedule qui `GET /api/cron/alerts?key=$ALERTS_CRON_SECRET`.
```
