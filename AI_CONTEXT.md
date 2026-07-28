# AI_CONTEXT — qp-frontend

> Fiche de contexte pour l'assistant IA. But : comprendre le projet sans relire
> tout le code. À maintenir à jour quand l'architecture change.
> Dernière mise à jour : 2026-07-28.

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
    page.tsx          # Accueil (SERVEUR) -> components/home/home-page-client.tsx
    about/page.tsx    # Page À propos (server -> AboutPageClient) [AJOUTÉE]
    park/[parkIdentifier]/  # Page d'un parc
      ride/[rideSlug]/      # Lien profond : page du parc + popup ouvert [AJOUTÉ]
  api/
    parks/route.ts              # GET liste des parcs + populaires (refresh client)
    park/[parkId]/route.ts      # GET données live d'un parc (refresh client)
    report/route.ts             # POST signalement de problème (rate-limité + honeypot)
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
2. La **couche métier** lit cette base via Prisma (`lib/prisma.ts` →
   `getPrisma()`), pas d'appel HTTP au worker :
   - `lib/park-live-data.ts` → `getParkIdentity()` / `buildParkLiveData()`
   - `lib/parks-list.ts` → `getParksWithHours()` / `getHomeData()`
3. **Premier affichage = rendu serveur** (2026-07-27). `app/[locale]/page.tsx` et
   `park/[parkIdentifier]/page.tsx` sont des composants SERVEUR qui appellent
   directement cette couche et passent les données en props. Le HTML servi
   contient donc les temps d'attente — auparavant les deux pages étaient des
   composants clients qui affichaient un squelette puis appelaient leur propre
   API (invisible pour les moteurs de recherche, et un aller-retour réseau de
   plus avant le premier contenu).
4. Les **routes API** (`/api/parks`, `/api/park/[parkId]`) partagent EXACTEMENT
   la même couche métier et ne servent plus qu'au **rafraîchissement client**
   (~60 s via `useAutoRefresh`). ⚠️ Toute évolution de la forme des données se
   fait dans `lib/`, jamais dans une route seule.

> ⚠️ **Les deux pages sont en `dynamic = "force-dynamic"`** : les temps d'attente
> et le classement des populaires sont vivants. La mise en cache se fait au
> niveau de la couche métier (liste des parcs mémorisée 5 min), pas de la page.

### Journal des consultations (`lib/api-request-log.ts`)

`api_request_logs` alimente le classement des « parcs populaires » (agrégation
sur 2 h). Deux règles, toutes deux corrigées le 2026-07-27 :

- **`logParkRequest()` n'est jamais attendu** (fire-and-forget, retour `void`
  pour empêcher un `await` par réflexe). L'écriture était auparavant `await`ée
  avant la réponse, sur *chaque* requête, donc à chaque rafraîchissement de
  chaque onglet.
- Le rendu serveur de la page parc journalise via **`after()`** (Next), donc
  après l'envoi de la réponse. Sans ça, seuls les rafraîchissements auraient été
  comptés et le classement se serait vidé de ses premières visites.
- **`purgeOldRequestLogs()`** (appelée par le cron des alertes, au plus une fois
  par heure, par lots de 10 000) applique une rétention de 7 jours
  (`API_LOG_RETENTION_DAYS`). La table grossissait sans limite alors que le
  `groupBy` de l'accueil ne regarde que 2 h — c'est ce qui aurait fini par
  ralentir la page d'accueil.

### Données structurées (`components/parks/park-json-ld.tsx`)

JSON-LD `AmusementPark` (nom, adresse, géo, image, horaires du jour convertis au
fuseau du parc) + `BreadcrumbList`, injecté par le composant serveur de la page
parc. Les types d'horaires `private_event` / `sold_out` sont exclus. **Ne baliser
que ce qui est visible sur la page** — Google traite le reste comme du spam.

### URL du site (`lib/site-url.ts`)

`getSiteUrl()` est la **source unique** de l'URL publique : `SITE_URL`, sinon
`AUTH_URL` (déjà positionnée par environnement), sinon la production. Elle était
codée en dur dans le layout, `robots.ts`, `sitemap.ts` et les JSON-LD, si bien
que sur `dev.queue-park.com` toutes les URL canoniques désignaient la production.
`isProductionSite()` conditionne l'indexation : **hors production, `robots.txt`
interdit tout** (un environnement de test indexable concurrence la production sur
ses propres pages).

### Liens profonds attraction (`app/[locale]/park/[id]/ride/[rideSlug]/`)

⚠️ **Ce n'est PAS une page attraction.** Cette route rend la page du parc à
l'identique, avec le popup de l'attraction déjà ouvert (`initialRideId` traverse
`ParkPageClient` → `MainCard` → `wait-time-table`). Elle sert aux notifications
push et au partage d'un lien d'attraction. Les vraies pages d'attraction sont sur
**Thrills**, pas ici — ne pas y reconstruire une page dédiée.

Conséquences assumées, à ne pas « corriger » :

- **canonical → la page du parc** et **absence du sitemap** : le contenu servi
  est celui du parc, indexer une URL par attraction soumettrait des dizaines
  d'adresses au contenu identique.
- Seuls le `<title>`, la description et la vignette OG sont propres à
  l'attraction — c'est ce que voit le destinataire d'un lien partagé.
- **L'identifiant d'URL est l'id numérique**, le nom n'est qu'un habillage
  (`lib/slug.ts`). Les noms d'attractions changent (le worker fait un UPDATE sur
  la ligne existante via la clé `parkId:externalId`, l'id est donc stable) :
  toute ancienne forme d'URL résout encore et **redirige en 301** vers la forme
  courante, donc aucune notification ni aucun lien partagé ne tombe dans le vide.
- L'attraction est résolue depuis la table `rides`, pas depuis les temps
  d'attente du moment : une attraction fermée pour la saison ne doit pas
  transformer un lien en 404. Si elle est absente du flux, la page du parc
  s'affiche sans popup.
- L'ouverture du popup est gardée par un `useRef` : sans lui, le
  rafraîchissement 60 s rouvrirait le popup après chaque fermeture.

**⚠️ L'œil de la liste est un `<a>` qui ne navigue pas** (clic simple →
`preventDefault` + popup ; Ctrl/⌘/clic milieu → vrai lien). Deux conséquences
contre-intuitives, déjà traitées dans `wait-time-table.tsx` :

- `prefetch={false}` **obligatoire** : il y a un lien par attraction et la route
  est `force-dynamic`, donc chaque préchargement re-rend la page complète du parc
  côté serveur. Sans ça, arriver sur un parc en déclenchait des dizaines.
- **NextTopLoader** (`app/layout.tsx`) pose un écouteur de clic sur `document`
  qui **ne teste pas `defaultPrevented`** : il démarrait sa barre sur un clic qui
  ne navigue pas, et rien ne venait jamais la terminer (barre + rond qui tournent
  à l'infini). Neutralisé par `e.nativeEvent.stopImmediatePropagation()` — un
  `stopPropagation` React ne suffit pas, React est branché sur le **même nœud** —
  doublé d'un `target="_self"` (la librairie ignore les ancres qui en portent un),
  pour ne dépendre ni de l'ordre d'enregistrement des écouteurs ni des détails de
  la librairie. **Même précaution pour tout futur `<a>` au clic annulé.**

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

### Historique & tendances — SUPPRIMÉS (2026-07-27)

Les flèches de tendance et l'historique global du jour, suspendus depuis
plusieurs semaines derrière les drapeaux `HISTORY_ENABLED`/`TRENDS_ENABLED`, ont
été **supprimés** : `components/parks/wait-trend.tsx`, la route
`/api/park/[parkId]/history`, la prop `history` traversant
`park-page-client → main-card → wait-time-table`, la prop `parkClosed`, la
vignette « tendance » du guide À propos et sa démo. Git conserve tout
l'historique si le besoin revient. ⚠️ À ne pas confondre avec le graphique du
popup attraction, qui lui est **actif** (route dédiée `ride/[rideId]/history`).

### Favoris (`components/providers/favorites-provider.tsx`)

**Le compte est la SOURCE DE VÉRITÉ.** Les favoris exigent une session ; il n'y a
donc aucun état « hors ligne » à réconcilier. `localStorage` n'est plus qu'un
**cache d'affichage** (`lib/favorites-storage.ts` :
`readFavoritesCache`/`writeFavoritesCache`/`clearFavoritesCache`) qui évite que
les étoiles clignotent au chargement.

- `FavoritesProvider` (monté dans `[locale]/layout.tsx`, **sous**
  `AuthGateProvider`) détient l'état, hydrate depuis le cache au montage puis
  depuis `GET /api/user/favorites`, purge tout à la déconnexion et se synchronise
  entre onglets via `storage`.
- `hooks/useFavorites.ts` n'est plus qu'un **sélecteur** sur ce contexte.
  `toggle` est **asynchrone** (`Promise<boolean>`) : `false` = non connecté (le
  garde a ouvert le modal) ou plafond atteint.
- Mutations **ciblées** : `PATCH /api/user/favorites` `{ namespace, key, value }`
  applique un seul favori et renvoie l'état complet, qui devient l'état affiché.
  Fini le `PUT` global debouncé et les fenêtres temporelles `mirroringUntil…` :
  deux onglets ne peuvent plus s'écraser mutuellement.
- **Plafond parcs = 20** (`PARK_FAVORITES_LIMIT`), désormais **vérifié côté
  serveur** (409) et plus seulement dans l'UI.
- La route `POST /api/user/favorites/merge` a été supprimée : rien ne pouvant
  être favorisé sans compte, il n'y avait plus rien à fusionner.

Les favoris sont épinglés en tête des listes. Dans `wait-time-table.tsx`, le
groupe des favoris est encadré de deux séparateurs ondulés ambrés
(`components/ui/wavy-divider.tsx`), celui du haut portant le libellé
`favorites.yours` (« Vos favoris »).
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

> **L'œil est un VRAI lien** (`<Link>` vers `/park/{parc}/ride/{slug}`) dont le
> clic simple est neutralisé pour ouvrir le popup. Ne pas le repasser en
> `<button>` : c'est ce qui rend une attraction partageable (« copier l'adresse
> du lien ») et fait fonctionner Ctrl+clic / clic milieu. Voir les **deux pièges**
> (préchargement, NextTopLoader) dans « Liens profonds attraction ». Le
> chargement de l'historique vit dans `hooks/useRideHistory.ts`.

> **Nom + icônes, jamais séparés** : le nom de l'attraction est découpé en
> « début » + « dernier mot », et ce dernier mot est rendu dans le même
> `whitespace-nowrap` que le chevron et l'œil. Sur mobile, les icônes se
> retrouvaient sinon **seules sur une ligne**, sans texte. Quand la place manque,
> c'est donc le dernier mot qui part à la ligne avec elles. Garde-fou : au-delà
> de 18 caractères, le dernier mot ne serait plus sécable et déborderait de la
> colonne → on repasse au flux normal.

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
  `lib/wait-times-history.ts` reconstruit la courbe **observée** du jour depuis
  `wait_times`. La **prévision** n'est plus calculée ici : elle est
  **précalculée par le worker** et stockée (`ride_forecast`, rafraîchie toutes
  les 10 min) ; la route la LIT (si `date` = jour logique courant, sinon périmée
  -> pas de prévision) et en extrait aussi la marge d'erreur mesurée.
  `lib/wait-times-series.ts` (ex-`wait-times-forecast.ts`, élagué : le moteur de
  prévision vivait encore ici en double du worker) ne porte plus que la
  reconstruction de la courbe observée — `sampleDaySeries` /
  `sliceIntervalsForWindow`.
- **Pas de badge de « fiabilité ».** `meta.confidenceLevel` est toujours renvoyé
  par l'API mais **n'est plus affiché** : il mesure le VOLUME de données
  disponibles (`0.2 + 0.08 × jours + 0.3 × recouvrement`), pas la justesse réelle
  de la prévision — ce qui rendait « Fiabilité : haute » systématique dès 7 jours
  d'historique. `chart-section.tsx` affiche à la place une mention neutre
  **« Estimation »** avec un tooltip (`attractionDetail.estimateTooltip`), plus la
  note « mise à jour à l'ouverture » si `preOpening`.
- **Bande d'incertitude « ± X min » (2026-07-28)** — remplace ce que le badge de
  fiabilité prétendait dire, cette fois **mesuré** :
  - Le worker confronte chaque jour ses prévisions à l'observé (table
    `forecast_accuracy`, cf. AI_CONTEXT du worker) et en déduit une marge par
    fenêtre d'horizon. **Chaque point** de `forecast` porte donc sa propre
    `margin` : l'erreur croît avec l'échéance, une marge unique pour toute la
    courbe serait trompeuse. `meta.marginMinutes`/`marginSamples` donnent la
    valeur agrégée (mention textuelle sous le graphique).
  - `margin` **absente/null = pas assez de mesures** -> aucune bande n'est
    tracée. On n'affiche jamais une incertitude qu'on ne connaît pas.
  - ⚠️ `wait-time-chart.tsx` est passé de `LineChart` à **`ComposedChart`** :
    la bande est une `Area` de PLAGE (`dataKey="band"`, valeur `[bas, haut]`),
    que `LineChart` n'accepte pas comme enfant. Rendu des `Line` inchangé.
  - La bande est ancrée à **largeur nulle sur le dernier point observé** : à
    l'instant présent l'attente est connue, l'incertitude ne s'ouvre qu'en
    avançant. Sans cet ancrage elle démarrait en marche d'escalier.
  - Le tooltip exclut `band` des lignes numériques (sa valeur est un couple) et
    reporte la marge sur la ligne « Prévision ». `yMax` englobe le HAUT de la
    bande, sinon elle est rognée par le cadre.
  - i18n : `attractionDetail.marginInline`/`marginLegend`/`marginTooltip`/
    `marginNote`. La démo À propos (`demos.tsx`) porte des marges factices
    croissantes pour montrer le comportement réel.

### Météo (ajout 2026-07)

- La route `GET /api/park/[parkId]` renvoie `weather: ParkWeather | null` :
  météo **courante** (`currentTemp`/`currentWeatherCode`, lus sur la ligne
  `Park`, remplis par le worker) + min/max du jour (`daily_weather`).
  `null` si ni courant ni prévision.
- Affichage : `components/parks/park-weather.tsx` dans le header du parc
  (sur la ligne de l'heure locale, séparé par un tiret) — icône `lucide` mappée
  par `lib/weather-icon.ts` (code WMO courant → icône + clé i18n) + **température
  actuelle** `22°C`. Le header masque le bloc si `currentTemp` absent. Les
  **min/max du jour** apparaissent au survol (et au tact) via `ClickableTooltip`,
  pas en permanence : l'en-tête porte déjà statut, horaires et heure locale.
  Sans min/max connus, aucun tooltip n'est monté.
- **Unité °C/°F** : préférence utilisateur calquée sur le format horaire.
  `TemperatureUnitProvider` (localStorage `temperature-unit-preference`, défaut
  **celsius**), hook `useTemperatureUnit`, conversion via `lib/temperature.ts`.
  Réglable dans le **profil** (`preferences-card`, segment °C/°F) et le
  **sélecteur du footer** (`language-switcher`, sous le format horaire).
  Intégrée au contrat `UserPreferences` (`temperatureUnit`, enum DB
  `TemperatureUnit`), synchro compte via `UserProvider` comme les autres prefs.
- i18n : namespace `weather` (fr+en, repli EN). Schema : modèle `DailyWeather`
  + `city`/`latitude`/`longitude` sur `Park` (⚠️ `prisma generate` requis).

## Robustesse & SEO (2026-07-27)

- **Fichiers spéciaux Next** : `app/robots.ts`, `app/[locale]/not-found.tsx`,
  `app/[locale]/error.tsx`, `app/not-found.tsx` (hors locale, textes en dur) et
  `app/global-error.tsx` (styles en ligne : aucun provider disponible). Écran
  partagé `components/ui/status-screen.tsx`, i18n `errorPages`.
- **Vrai 404** : `park/[parkIdentifier]/page.tsx` appelle `notFound()` si le parc
  n'existe pas (au lieu d'un 200 + redirection client). La recherche du parc
  passe par un `cache()` React partagé avec `generateMetadata` (1 seule requête).
- **OG image dynamique** : `park/[parkIdentifier]/opengraph-image.tsx`
  (`revalidate = 900`) rend nom du parc + attente moyenne + attraction la plus
  demandée ; `ride/[rideSlug]/opengraph-image.tsx` rend le nom de l'attraction et
  son attente du moment. Ne PAS remettre de clé `images` dans `generateMetadata`,
  sinon elle écrase la vignette générée. i18n `og`.
- **Icônes** : `favicon-16x16.png`, `favicon-32x32.png`, `apple-touch-icon.png`
  vivent dans `public/` (dans `app/` elles n'étaient pas servies — seul
  `favicon.ico` y est une convention Next).
- **Cache** : `sitemap.ts` en `revalidate = 3600` ; `/api/parks` mémorise
  parcs + horaires 5 min en mémoire (comme `lib/ip-rules.ts`) et renvoie
  `s-maxage=60` ; `/api/park/[parkId]` reste en `no-store` **volontairement** (il
  alimente `apiRequestLog`, base des « parcs populaires »).
- **Optimiseur d'images** : `IMAGE_ALLOWED_HOSTS` (env, hôtes séparés par des
  virgules) restreint `remotePatterns` ; vide = permissif (comportement
  historique). `BUILTIN_IMAGE_HOSTS` dans `next.config.ts` porte les hôtes imposés
  par le code (avatars Google) : les oublier casserait toutes les photos de
  profil.
- **Liens profonds push** : alerte sur UNE attraction →
  `/{locale}/park/{parc}/ride/{slug}` (parc + popup ouvert) ; plusieurs → page du
  parc ; rappel de spectacle → page du parc avec `?tab=shows` (lu par
  `main-card.tsx` pour choisir l'onglet initial).
- **`/api/report`** : plafond 5/h par IP (`lib/rate-limit.ts`, fenêtre glissante
  en mémoire) + champ honeypot `website` (réponse 200 silencieuse). L'e-mail d'un
  utilisateur connecté vient de la **session**, jamais du corps de la requête.
- **Cron alertes** : verrou en mémoire anti-chevauchement (`acquireRunLock`,
  abandon après 5 min). Sans lui, un passage lent chevauchait le suivant et la
  même alerte partait deux fois (on envoie AVANT de désarmer / supprimer).
- **Auto-refresh** : `hooks/useAutoRefresh.ts` gère lui-même la visibilité de
  l'onglet (un seul intervalle 1 s, arrêté quand l'onglet est caché, rattrapage
  au retour). `usePageVisibility` a été supprimé.
- **⚠️ `Intl` et hydratation** : `Intl.DisplayNames` s'appuie sur les données ICU
  du runtime, et Node ≠ navigateur (`HK` → « Hong Kong SAR China » côté Node,
  « Hong Kong » côté Chrome). Depuis que l'accueil est rendu côté serveur, tout
  appel pendant le rendu d'un composant client provoque une erreur
  d'hydratation. Le nom de pays est donc résolu **une seule fois côté serveur**
  (`lib/parks-list.ts` → `ParkList.countryName`) ; `getCountryName` ne doit plus
  être appelée depuis un composant client. Même piste pour
  `toLocaleLowerCase()`/`toLocaleDateString()` sans locale explicite : ils
  dépendent de la locale par défaut du runtime.
- **Accessibilité** : `wait-time-table.tsx` n'est pas un `<table>` (blocs animés)
  mais porte les rôles ARIA `table`/`rowgroup`/`row`/`columnheader`/`rowheader`/
  `cell` + `aria-sort`. Toute nouvelle ligne doit conserver cette structure.

## Conventions

- Composants avec état/hooks/browser → `"use client"`. Pages `page.tsx` de route
  = server components qui exportent `generateMetadata` puis rendent un client.
- `cn()` (`lib/utils`) = clsx + tailwind-merge ; passer des classes qui écrasent
  les défauts (ex. `Card` a `py-6 gap-6 rounded-xl`, surchargeable).
- Le « container temps d'attente » = `components/parks/main-card.tsx` : `Card`
  arrondie `rounded-4xl` avec `Tabs` et une pastille coulissante iOS-like.
  La page À propos réutilise ce motif.
- Commentaires du code en français, orientés « pourquoi ».

## node/npm dans le shell agent

Disponibles via `Documents/Windsurf/nodejs/node-v22.15.0-win-x64` (sur le PATH du
shell bash au 2026-07-28 ; ça ne l'était pas auparavant). `npx tsc --noEmit` et
`npx prisma generate` tournent donc ici — les utiliser plutôt que de se fier à la
seule revue manuelle. `prisma generate` n'accède pas à la base ; **`db push` et
`migrate` si**, ne pas les lancer sans demander.

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
  **thème, compte, langue | À propos**. Le compte = `components/ui/footer-auth.tsx`
  (client) : connecté → lien `/profile` (avatar + « Profil ») ; sinon → bouton
  d'auth ouvrant `AuthDialog`. Le « | » sépare les **réglages** (thème, compte,
  langue) de la **navigation** (À propos).

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
  Alertes / Préférences). Onglet **Alertes** = **fil unifié** (`AlertsSection`) :
  sous-onglets **Actives / Historique** + filtre **Tout · Attractions ·
  Spectacles** (le type = attribut de ligne : pastille `RollerCoaster` vs
  `Drama`), une seule liste pleine largeur ; interrupteur d'activation en
  **Switch à icône** (`size="lg"`, cloche active/barrée). Onglet **Préférences**
  = **contrôles tactiles** (`PreferencesCard`) : thème en **3 vignettes** (soleil
  / lune / écran), heure en **interrupteur segmenté** 24 h/12 h, langue en menu.
  En tête : **3 vignettes** cliquables (parcs favoris
  `x/20`, attractions favorites, alertes actives) → popups favoris.
  Squelette : `components/profile/profile-skeleton.tsx`
  (affiché tant que la session charge). La **création** d'alerte reste réservée au
  popup « détail attraction » ; le profil permet de **modifier le seuil**,
  (dé)activer et supprimer.
- **`AuthDialog` fusionné** : connexion et inscription = un seul flux passwordless,
  donc plus de prop `mode` — libellé neutre unique (`auth.title`/`auth.subtitle`).
- **Historique** (`components/profile/alert-history-section.tsx`, export
  `AlertHistoryFeed`, prop `filter`) : fil **unifié** (attractions + spectacles
  fusionnés, triés par date d'envoi), **sondage** tant que la page est ouverte
  (nouvelle notif animée en direct), **voir plus/moins** au-delà de 10 entrées.
  Sources : `AlertHistory` (attractions) et **`ShowReminderHistory`** (spectacles,
  table dédiée append-only écrite à l'envoi par le cron — l'historique survit à
  l'édition/suppression d'un rappel ; le `ShowReminder` consommé est supprimé).
  **Rien n'est purgé** côté base ; les routes `/api/user/alerts/history` +
  `/api/user/show-reminders/history` bornent juste l'**affichage** à 30 jours.
  ⚠️ `ShowReminderHistory` : penser à `npm run user:generate` + `user:push`.
- i18n : namespaces `userBlock`, `auth`, `profile`, `alerts` (fr+en).
## Divers (2026-07-20)

- **Manifest PWA localisé par langue** : route dynamique
  `app/[locale]/manifest.webmanifest/route.ts` (`force-static` + `generateStaticParams`
  sur les locales) servant un manifeste traduit (namespace i18n `manifest`,
  `name`/`description`/raccourcis, `lang`/`start_url` cohérents). Le
  `<link rel="manifest">` est posé par `generateMetadata` du layout
  (`manifest: /${locale}/manifest.webmanifest`). Seuls fr+en traduits (repli EN).
- **Icônes PWA — `purpose: "any"` uniquement, jamais `any maskable`** : le logo
  est un **disque** corail sur fond transparent. Le fourre-tout `any maskable`
  laissait Android lui appliquer son masque (cercle, squircle, goutte), rognant
  le disque et bouchant les coins en blanc — une icône `maskable` doit être
  opaque bord à bord avec son contenu dans le cercle de sécurité à 80 %. Choix
  assumé : on reste sur le PNG transparent, qui s'intègre mieux qu'un fond plein
  rogné. `theme_color`/`background_color` = **`#0b0b0e`** et non du blanc : le
  `background_color` peint l'écran de démarrage **derrière le logo corail**, un
  fond clair (a fortiori corail) le rendait invisible. La spec n'y accepte qu'une
  couleur unie, pas de dégradé.
- ⚠️ **`public/apple-touch-icon.png` doit être OPAQUE** : iOS compose la
  transparence sur du **noir**, pas sur du blanc — le logo atterrissait dans un
  carré noir sur l'écran d'accueil. Il porte donc un dégradé diagonal
  `#c75138 → #640606`, repris des couleurs **échantillonnées dans le logo** (le
  corail du disque assombri d'un cran vers le rouge du wagon). Le corail pur est
  volontairement écarté : c'est la couleur du disque, un fond corail le rend
  invisible. Logo à 88 % (le masque iOS rogne peu, pas de zone de sécurité à 80 %
  comme Android). Régénération : `node scripts/generate-apple-icon.mjs`.
  ⚠️ iOS ne sait PAS servir deux icônes selon le mode clair/sombre pour une page
  web (`media` est ignoré sur `apple-touch-icon`, les variantes d'iOS 18 passent
  par l'`Assets.xcassets` d'une app native) : ce fond unique doit tenir sur les
  deux, d'où le choix d'un fond sombre.
- **Préférences — concurrence** : `PATCH /api/user/preferences` fait un **seul
  `upsert`** avec **retry** sur l'erreur MariaDB « Record has changed since last
  read » (déclenchée par des changements de langue rapprochés qui enchaînent les
  requêtes). Le dernier écrit gagne.
- **Graphique — axe des heures** : le pas entre deux graduations est **calculé**
  (1/2/3/4/6/12 h, au plus 5 intervalles) et l'axe est en `interval={0}`, donc
  recharts affiche exactement les graduations fournies. Une graduation par heure
  ne tient pas dans la largeur du popup : avec `preserveStartEnd` + `minTickGap`,
  recharts parcourait la liste **en partant de la fin** et masquait
  l'avant-dernière heure pleine, seule, au milieu d'une suite régulière (on lisait
  10:00 … 15:00 puis 17:00). Marges d'un pas côté ouverture et d'un demi-pas côté
  fermeture, pour qu'aucune graduation ne vienne se coller aux bornes.
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
