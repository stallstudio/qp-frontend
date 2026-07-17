# AI_CONTEXT — qp-frontend

> Fiche de contexte pour l'assistant IA. But : comprendre le projet sans relire
> tout le code. À maintenir à jour quand l'architecture change.
> Dernière mise à jour : 2026-07-17.

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

`localStorage`, **sans compte**. Namespaces isolés (`"parks"`, `"rides"`).
SSR-safe (hydratation après montage), synchronisé entre onglets (`storage`) et
instances (`qp-fav-change`). Les favoris sont épinglés en tête des listes.

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
- `components/about/about-header.tsx` : **en-tête fixe scroll-shrink** identique à
  l'accueil / une page parc (spacer + carte `fixed` qui rétrécit, lien de retour
  qui se fond). Réutilisé par la page À propos pour un comportement cohérent.
- `components/about/about-page-client.tsx` : hero + `Card` à **2 onglets**
  (`about` = le projet, `guide` = les fonctionnalités), grilles de `Vignette`.
- `components/about/vignette.tsx` : petite carte (icône + titre + texte + démo).
- `components/about/demos.tsx` : mini-démos **vivantes** réutilisant les vrais
  composants (`WaitTrend`, `FavoriteStar`, badges) — pas d'images statiques.
- Contenu i18n sous le namespace `about` dans `fr.json` + `en.json` (fallback EN
  pour les autres langues).
- Lien « À propos » ajouté dans `components/ui/footer.tsx` (label = `about.metaTitle`).
```
