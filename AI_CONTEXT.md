# AI_CONTEXT — qp-frontend

> Fiche de contexte pour l'assistant IA. But : comprendre le projet sans relire
> tout le code. À maintenir à jour quand l'architecture change.
> Dernière mise à jour : 2026-08-07.

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
  parks/             # header, main-card (COLONNE de cartes), section-card,
                     # event-card, wait-time-table,
                     # show-time-table, wait-trend (flèches), cover-image, opening-hours...
  about/             # vignette.tsx, demos.tsx, about-page-client.tsx [AJOUTÉ]
  ui/                # primitives (card, tabs, button, footer, favorite-star, table...)
  search/ providers/ theme-provider
hooks/               # useFavorites, useAutoRefresh, usePageVisibility, useTimeFormat, useWaitTimeChanges
i18n/                # routing.ts (locales), request.ts (chargement messages + fallback EN)
lib/                 # badge.tsx (pastilles temps/statut), prisma.ts, wait-times.ts,
                     # show-times.ts, opening-hours.ts, ip-rules.ts, utils.ts, report-config.ts
                     # ⚠️ report-config.ts ne décrit QUE les catégories du
                     # formulaire de signalement (+ libellés Discord). Les
                     # RÉPONSES de résolution en ont été retirées le 2026-08-18 :
                     # elles vivent dans l'admin (table `report_templates`), le
                     # frontend n'en lisait aucune et sa copie ne pouvait que
                     # diverger du texte réellement envoyé aux utilisateurs.
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

## La table `pois` (migration du 2026-08-21)

`rides` et `shows` ont fusionné en une seule table `pois`, discriminée par
`kind` (`ride` | `show`). Côté frontend : `wait_times.rideId` et
`show_times.showId` s'appellent `poiId`, et les relations Prisma `ride` / `show`
s'appellent `poi` (`lib/wait-times.ts`, `lib/show-times.ts`,
`lib/ride-detail.ts`, `lib/wait-times-history.ts`, `app/api/cron/alerts`).
Déroulé complet : `migrations/2026-08-21-pois/README.md` **du worker**.

⚠️ **Toute lecture d'attraction précise `kind: "ride"`.** Mesuré en production,
**40 `externalId` désignent une attraction ET un spectacle différents** dans le
même parc. Sans le filtre, l'identifiant d'un spectacle ouvrirait la page
« historique d'attraction » d'une entité qui n'a pas de file.

⚠️ **La base UTILISATEURS n'a PAS été touchée, et c'est ce qui a dicté la
migration.** `Alert.rideId`, `AlertHistory.rideId` et les favoris d'attraction
(`{parkIdentifier}:{rideId}`) référencent la base principale **sans clé
étrangère inter-bases** : rien n'aurait signalé une dérive. Les identifiants
d'attraction ont donc été conservés à l'identique ; seuls les spectacles ont été
décalés (+1 000 000), et rien ici ne référence un spectacle par identifiant —
`ShowReminder` passe par `(parkIdentifier, showName, startTime)` et les favoris
de spectacle par `{parkIdentifier}:{showName}`.

## Flux de données

1. Le **worker** remplit la base (parcs, pois, wait_times, show_times,
   opening_hours…).
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
  par heure, par lots de 10 000) applique une rétention de **30 jours**
  (`API_LOG_RETENTION_DAYS`). La table grossissait sans limite alors que le
  `groupBy` de l'accueil ne regarde que 2 h — c'est ce qui aurait fini par
  ralentir la page d'accueil.

  ⚠️ **La rétention n'est pas qu'un réglage d'hygiène : c'est ce que l'ADMIN
  peut afficher.** À 7 jours (valeur d'origine), la fenêtre « Last 30 days » de
  sa page Requests ramenait exactement la même chose que « Last 7 days » —
  mesuré le 2026-08-04 : 14 672 IPs contre 14 771, l'écart n'étant que le
  reliquat pas encore purgé. Ça se lisait comme un bug de comptage. La valeur est
  donc alignée sur la plus large fenêtre proposée par l'admin : la raccourcir à
  nouveau y remettrait le même piège.

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
- L'attraction est résolue depuis la table `pois` (`kind: "ride"`), pas depuis
  les temps d'attente du moment : une attraction fermée pour la saison ne doit pas
  transformer un lien en 404. Si elle est absente du flux, la page du parc
  s'affiche sans popup.
- L'ouverture du popup est gardée par un `useRef` : sans lui, le
  rafraîchissement 60 s rouvrirait le popup après chaque fermeture.

**⚠️ Deux pièges à connaître avant de remettre un `<a>` au clic annulé dans une
liste.** La liste n'en contient plus (l'œil, seul lien de ce genre, a été retiré
le 2026-07-28 au profit d'une ligne cliquable), mais les deux ont coûté cher :

- `prefetch={false}` **obligatoire** : il y aurait un lien par attraction et la
  route est `force-dynamic`, donc chaque préchargement re-rend la page complète du
  parc côté serveur. Sans ça, arriver sur un parc en déclenchait des dizaines.
- **NextTopLoader** (`app/layout.tsx`) pose un écouteur de clic sur `document`
  qui **ne teste pas `defaultPrevented`** : il démarrait sa barre sur un clic qui
  ne navigue pas, et rien ne venait jamais la terminer (barre + rond qui tournent
  à l'infini). Se neutralise par `e.nativeEvent.stopImmediatePropagation()` — un
  `stopPropagation` React ne suffit pas, React est branché sur le **même nœud** —
  doublé d'un `target="_self"` (la librairie ignore les ancres qui en portent un),
  pour ne dépendre ni de l'ordre d'enregistrement des écouteurs ni des détails de
  la librairie.

### Parcs populaires

Calculés dans `api/parks/route.ts` : `apiRequestLog.groupBy(parkId)` sur les
**2 dernières heures**, statut 200, IP non whitelistées, top 8 → 6 affichés.
C'est donc un classement par **nombre de consultations récentes**.

### Liste « Tous les parcs » — catégories repliées (2026-07-30)

`park-category-card.tsx` sait se **replier** à
`CATEGORY_COLLAPSE_LIMIT = 10` parcs : 10 lignes + « Voir les N autres parcs »
(même motif que les parcs favoris de l'accueil). Déclencheur : Fantawild
(华强方特) et ses **49 parcs**, qui écrasaient une colonne entière.

- ⚠️ **Deux catégories EN DUR, pas un seuil générique** (choix produit) :
  `parks-list.tsx` (`COLLAPSED_GROUP_MATCH = "fantawild"`,
  `COLLAPSED_COUNTRY_CODE = "CN"`) passe une prop `collapsible` ; la carte ne
  décide rien (elle ignore si on trie par groupe ou par pays). Groupe Fantawild
  en tri « par groupe », Chine en tri « par pays » — ce sont les MÊMES parcs vus
  des deux façons. Partout ailleurs la liste reste entière, notamment pour les
  liens internes (voir « Effet SEO » ci-dessous).
- Le test porte sur les **données** d'un parc de la catégorie (`group.name`,
  `country === "CN"`), jamais sur le libellé affiché : en tri par pays celui-ci
  vient d'`Intl.DisplayNames` et n'est pas une constante fiable.
- **Ordre d'une catégorie repliable : parcs OUVERTS d'abord**, alphabétique dans
  chaque bloc (`sort` stable sur une liste déjà triée par nom). Les 10 places
  visibles vont aux parcs consultables maintenant, pas aux dix premiers de
  l'alphabet — dont la moitié dort quand il fait nuit en Chine. Cet ordre est
  **conservé une fois déplié** (sinon la liste se réordonnerait sous le doigt au
  moment du clic), et les catégories courtes restent purement alphabétiques.
- Le dépliage réutilise l'`AnimatePresence` existante des parcs : aucune
  animation dédiée, les lignes révélées arrivent comme celles que le filtre
  « Masquer les parcs fermés » fait revenir.
- ⚠️ `splitGroupsBalanced` (`parks-list.tsx`) compte la hauteur **affichée**
  (`min(n, 10) + 1` pour une catégorie repliée), pas le nombre de parcs : sinon
  Fantawild pesait 49 dans la balance et sa colonne finissait bien plus courte
  que les deux autres.
- i18n : `parksList.seeMoreParks` / `parksList.seeLess` (fr+en, repli EN).
- **Effet SEO assumé** : les parcs repliés sont **absents du HTML** (rendu
  conditionnel, pas un masquage CSS) et Googlebot ne clique pas le bouton — ils
  perdent leur lien interne depuis l'accueil et ne restent découvrables que par
  `sitemap.ts`. C'est précisément pourquoi la règle est limitée à ces deux
  catégories. Variante zéro-perte si le besoin change : garder les 49 dans le DOM
  et replier en CSS (`max-height`/`overflow-hidden`), au prix de l'animation par
  ligne (l'`AnimatePresence` ne joue que sur ce qui entre/sort du DOM).

### Badges de parc (`components/parks/park-card.tsx`)

`ParkList.badge` vient de la colonne texte `Park.badge`, réglée dans l'admin.
Trois valeurs historiques (`new`, `featured`, `updated`) rendues en dégradé fixe
et affichées **telles quelles en base, non traduites** — c'est l'existant, pas
un choix à reproduire.

**`exclusive`** (ajout 2026-08-05) = le parc n'est suivi en direct que sur Queue
Park. Affiché **« EXCLU »**, et traité **à part** des trois autres :

- ⚠️ **Libellé NON traduit**, comme les trois autres — les badges sont
  identiques dans les 14 langues. Une version traduite (namespace i18n
  `parkBadge` + infobulle) a été écrite puis **retirée** : en faire l'exception
  suffisait à casser la règle. Ne pas la réintroduire.
- ⚠️ Le libellé ne peut pas non plus venir de la base comme les trois autres :
  celle-ci stocke la clé `exclusive`, dont la mise en majuscules donnerait
  « EXCLUSIVE ». D'où la constante `EXCLUSIVE_LABEL`.
- c'est le **seul badge animé** : dégradé ambré qui défile, via le composant
  déjà présent `components/ui/animated-gradient-text.tsx` (keyframes `gradient`
  de `globals.css`). Dans une liste où deux cents lignes se ressemblent, seul le
  MOUVEMENT accroche l'œil — une quatrième couleur fixe se serait fondue dans
  les trois autres. ⚠️ `motion-reduce:animate-none` : le réglage système coupe
  le défilement **sans effacer le badge**.
- ⚠️ **La cadence se règle par `duration` (3 s), jamais par `speed`.** Les 8 s
  par défaut des keyframes sont calées pour un titre de héros ; sur une
  étiquette de cinq lettres dans une liste, un passage toutes les huit secondes
  se rate simplement. `speed` élargit le dégradé — la bande claire va plus vite,
  mais il y a toujours **un** balayage par cycle, `--bg-size` servant à la fois
  de largeur de motif et de distance parcourue par les keyframes. `duration` a
  été ajouté au composant pour ça.

⚠️ **Un parc ne porte qu'UN badge** : `Park.badge` est une colonne texte, pas un
jeu de drapeaux. « Nouveau » et « exclusif » s'excluent — arbitrage assumé pour
ne pas migrer le schéma dans les trois dépôts.

⚠️ **Un badge changé dans l'admin met jusqu'à 5 MINUTES à apparaître ici**, et
ça se lit comme une écriture qui a échoué : `getParksWithHours()` mémorise la
liste des parcs (`PARKS_CACHE_TTL_MS`, `lib/parks-list.ts`), et le badge en fait
partie. Vu en vrai le 2026-08-05 — un parc passé en `exclusive` continuait
d'afficher `NEW`. La base était juste, le cache non. Redémarrer le serveur vide
le cache (il vit sur `globalThis`).

⚠️ L'admin **recopie ce rendu** (`components/parks/park-badge.tsx` là-bas) pour
qu'on voie ce qu'on règle : les couleurs, l'animation et les libellés doivent
bouger des deux côtés à la fois.

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

#### Accès continu — DEUX règles, parce qu'il y a deux familles de sources

`show-time-table/utils.ts`. Certaines « attractions-spectacles » ne sont pas des
représentations à heure fixe mais des **accès continus** : le popup affiche alors
`continuousAccess` (« En continu · 12:00 – 20:15 ») et non `duration`.

⚠️ **La règle du ratio ne peut PAS voir le cas inverse, et c'est structurel.**
Elle suppose une durée de visite COURTE dans un créneau long (Puy du Fou : 20 min
dans 8 h, ratio 24) et exige `amplitude ≥ 3 × duration`. **Miral fait l'inverse :
il annonce toute la plage d'accès comme `duration`.** Mesuré le 2026-08-07 :

| | `duration` | créneau | amplitude |
| --- | --- | --- | --- |
| Yas Ladies Day | 540 min | 09:00 → 18:00 | 540 min |
| Yas Ladies Night | 240 min | 13:00 → 17:00 | 240 min |

L'amplitude vaut alors exactement la durée, donc le ratio est faux — et il l'est
**d'autant plus que le cas est évident**. « Yas Ladies Day » s'affichait
« Durée : 9 heures », ce qui ne décrit aucun spectacle.

D'où une **seconde porte d'entrée** : `amplitude ≥ 240 min` **et**
`|amplitude − duration| ≤ 15 min` ⇒ accès continu. Aucun spectacle ne dure quatre
heures ; une plage d'accès de quatre heures, si.

⚠️ **Le seuil est à 240 min et non aux 120 min de `CONTINUOUS_MIN_SPAN_MIN`**,
sinon la règle happerait de vraies représentations longues. Vérifié sur toute la
base : à 240 min elle ne retient **que** les deux créneaux de Yas Waterworld. Les
jeux Fantawild de Huaian (`duration` 265 pour une amplitude de 160) sont écartés
par la tolérance ; 丝路盛景 (150 / 150) reste sous le seuil.

- `components/parks/show-time-table/` : timeline horizontale (colonne de noms +
  créneaux positionnés). États visuels d'un créneau (voir `timeline-row.tsx`) :
  **terminé** = `bg-muted/50` grisé + `border-border`, **en cours** =
  `bg-primary/10` bordure pointillée, **à venir** = `bg-primary/20` bordure
  pleine. Une **légende** (namespace i18n `shows.legend*`) est rendue sous la
  timeline sur chaque page.
  ⚠️ **Les trois états portent une bordure, y compris « terminé »**
  (2026-08-05). Le créneau passé n'en avait pas, alors que sa pastille de
  légende, elle, en a une : sur la timeline il se fondait dans la grille (le
  fond `muted/50` est presque celui des lignes d'heures) quand les deux autres
  états étaient cernés. C'est aussi ce qui garde les trois états à la même
  taille intérieure — `border` compte dans la boîte, un seul état sans bordure
  serait 1 px plus haut que ses voisins.
- **Même comportement que les attractions** (2026-07-28) : plus d'œil, un clic
  n'importe où sur la ligne ouvre `show-detail-dialog.tsx`, cloche `BellRing` en
  bout de nom si un rappel est programmé, survol qui allume les **deux moitiés**
  de la ligne (état `hoveredUid` partagé nom ↔ timeline, `duration-500` comme les
  attractions). ⚠️ La timeline est aussi cliquable, avec deux garde-fous : le clic
  final d'un **glisser-défiler** est ignoré (`draggedRef`, seuil 5 px) et un clic
  sur un créneau étroit n'ouvre que son infobulle (`stopPropagation`).
- ⚠️ **Tout se mesure en minutes depuis le début du jour LOGIQUE du parc**
  (`getParkDayStart` dans `utils.ts`), jamais en heure du mur (`.hour`). Les
  colonnes peuvent donc dépasser 23 : `24` = colonne « 00:00 » du lendemain
  (plafond `MAX_GRID_END_HOUR = 27`). Avant, `Math.min(23, …)` bornait la grille :
  un spectacle de 23:55 (Disneyland California, ouvert jusqu'à minuit) débordait
  et se retrouvait **rogné au bord droit**. Conséquences : l'en-tête compose ses
  libellés en `dayStart.plus({ hours })` (`set({ hour })` refuse 24), un créneau
  d'après minuit se place à 24 h+ au lieu de repartir à gauche, et le repère
  « maintenant » se teste sur sa **position** (il disparaissait après minuit quand
  on le comparait à `now.hour`).

#### La date d'un créneau n'est pas sa journée d'exploitation (2026-08-25)

⚠️ **Une nocturne à cheval sur minuit est coupée en deux par le CALENDRIER, pas
par l'exploitation.** Les sources datent chaque créneau au jour local : Halloween
Horror Nights tourne de 19:00 à 01:00, ses dernières représentations sont donc
rangées sous le LENDEMAIN, et celles de la veille sous AUJOURD'HUI.

Mesuré sur Universal Studios Florida le 25/08 à 16:00 : la carte HHN affichait
les représentations de 00:00, 00:30 et 00:45 — la fin de la nuit du 24 — déjà
grisées, sous un en-tête annonçant « Ouvre à 19:00 ». Le symétrique était pire :
passé minuit, les représentations de la nuit EN COURS disparaissaient de la
grille, rangées sous une date que personne ne chargeait.

Deux pièces, et il faut les deux :

1. `getShowTimesByParkAndDates` charge le jour logique **et le lendemain** — la
   date en base ne sert plus que de pré-filtre grossier ;
2. `limitShowsToSessions` (`lib/show-window.ts`, module PUR) ne garde que les
   créneaux qui tombent dans une **séance** du jour, à une heure près. Un
   spectacle sans créneau restant est retiré — donc la carte d'événement ne se
   rend pas, ce qui vaut mieux qu'une grille montrant la nuit d'avant.

⚠️ **Les deux camps n'ont pas la même fenêtre.** Un spectacle tagué `eventId`
n'est confronté qu'aux séances de SON événement — c'est ce qui écarte la nuit
précédente, dont les heures tombent en plein dans la journée d'aujourd'hui. Un
spectacle NON tagué, lui, est confronté à **toutes** les séances, nocturnes
comprises : le restreindre à l'exploitation de jour supprimerait les
représentations de 23:00 d'un parc dont la nocturne existe mais dont les
spectacles ne sont pas tagués. Une donnée incomplète ne doit pas faire
disparaître de la donnée juste.

⚠️ Sans horaires publiés, **rien n'est filtré** : le repli garde la donnée telle
quelle, faute de quoi la grille disparaîtrait chez tous les parcs muets sur leurs
horaires. Côté worker, `showService.saveShowTimes` re-date en parallèle chaque
créneau sur la séance qui le contient (`utils/operatingDay.ts`) — mais seulement
ceux que la source publie encore, jamais l'historique déjà en base.

### Événements saisonniers (`lib/park-events.ts`, `components/parks/event-card.tsx`)

Une carte repliable par événement (Halloween, Noël), qui contient les
attractions et les spectacles TAGUÉS avec son `eventId`. Le chargement vit dans
`lib/park-events-db.ts`, l'état d'affichage dans le module PUR
`lib/park-events.ts`, évalué **après montage** (la fenêtre dépend de l'heure
courante, qui diffère entre Node et le navigateur).

⚠️ **Une attraction taguée n'apparaît QUE dans la carte de son événement.** Hors
période, la carte n'est pas rendue et l'attraction disparaît donc de la page —
c'est voulu : un maze affichant « fermé » en juin entre deux coasters n'apprend
rien.

⚠️ **`visibility = "forced"` (« Toujours » dans l'admin) garde sa carte MÊME
VIDE** (2026-08-24), et c'est la seule exception à « pas de contenu, pas de
carte ». Cette règle vaut pour un événement `auto` — elle évite un encadré vide
dans l'onglet Spectacles onze soirs sur dix — mais `forced` est une décision
HUMAINE dont l'aide de l'admin dit « la carte s'affiche en permanence ». La taire
faute de contenu rendait le réglage inopérant SANS RIEN DIRE : on cherche alors
le bug dans la visibilité, la période, la traduction, partout sauf où il est.

Mesuré sur Universal Studios Florida : les huit maisons de Halloween Horror
Nights sont bien créées et taguées, mais l'API a cessé de les émettre le 21/08 —
leurs lignes `wait_times` restent ouvertes avec un `lastSeenAt` figé, et
`getLatestWaitTimesByPark` les écarte au-delà de `STALE_WAIT_TIME_MS` (3 jours).
La carte n'avait donc plus rien à contenir et disparaissait alors même qu'on
venait de demander l'inverse.

⚠️ La carte vide n'apparaît QUE dans l'onglet des temps d'attente (le défaut),
jamais dans les deux : le même encadré vide de part et d'autre du sélecteur se
lirait comme deux événements distincts. `EventCard` portait déjà `isEmpty` /
`emptyLabel` pour ça — c'est l'appelant qui ne s'en servait pas.

⚠️ **`NON_DAY_HOUR_TYPES` exclut `event`** (billet séparé) mais PAS `extension`
(même billet, journée prolongée). Une nocturne qui court jusqu'à 1 h rouvrirait
sinon le droit aux alertes de réouverture sur TOUTES les attractions, y compris
celles de jour arrêtées pour la nuit, et étirerait l'axe du graphique du jour.

### Historique & tendances — SUPPRIMÉS (2026-07-27)

Les flèches de tendance et l'historique global du jour, suspendus depuis
plusieurs semaines derrière les drapeaux `HISTORY_ENABLED`/`TRENDS_ENABLED`, ont
été **supprimés** : `components/parks/wait-trend.tsx`, la route
`/api/park/[parkId]/history`, la prop `history` traversant
`park-page-client → main-card → wait-time-table`, la prop `parkClosed`, la
vignette « tendance » du guide À propos et sa démo. Git conserve tout
l'historique si le besoin revient. ⚠️ À ne pas confondre avec le graphique du
popup attraction, qui lui est **actif** (route dédiée `ride/[rideId]/history`).

### Alertes actives dans les listes (`components/providers/notifications-provider.tsx`)

Provider monté dans `[locale]/layout.tsx` **sous** `FavoritesProvider`. Il charge
UNE fois `GET /api/user/alerts` + `GET /api/user/show-reminders` et expose
`alertRideIds` / `reminderShowKeys` (clé `${parc}:${nomDuSpectacle}`, helper
`showReminderKey`) — c'est ce qui allume la **cloche** des lignes. Un fetch par
ligne serait absurde sur un parc à 50 attractions, et les deux tableaux
coexistent sur la même page.

- **Pas de cache localStorage**, contrairement aux favoris : une alerte ne vaut
  que pour la journée et peut être supprimée par le moteur — un cache périmé
  afficherait des cloches fantômes.
- `refresh()` est appelé par `alert-section.tsx` / `reminder-section.tsx` après
  création ou suppression, et par la remise à zéro du profil.
- Resynchronisation au **retour d'onglet** (`visibilitychange`) : une alerte qui
  notifie est supprimée côté serveur, la cloche resterait sinon allumée jusqu'au
  rechargement — précisément au moment où l'utilisateur revient dans l'app après
  avoir reçu la notification. Pas d'interrogation périodique.

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

**Un clic n'importe où sur la ligne** ouvre `attraction-detail-dialog.tsx` — plus
d'icône œil (2026-07-28), plus d'étoile/cloche cliquable dans la liste. Le popup
empile des sections : image (placeholder `CameraOff`), favoris
(`favorite-section.tsx`), alertes (`alert-section.tsx`), graphique
du jour + prévision (`chart-section.tsx` → `wait-time-chart.tsx`), et Thrills
(`thrills-section.tsx`, lien placeholder vers thrills.world).

> **Ligne cliquable vs chevron** : la ligne entière (standby ET files
> secondaires) ouvre le popup ; le **chevron** est la SEULE zone qui ne le fait
> pas — il déplie les files secondaires et arrête la propagation (clic et
> clavier). D'où son `p-1` (+ `-my-1` pour ne pas grandir la ligne) et son fond au
> survol : la cible doit être atteignable au doigt et se lire comme une commande
> distincte. Les lignes portent `tabIndex`/Entrée/Espace : l'œil était le seul
> élément focusable, il fallait le remplacer.

> ⚠️ **Perte assumée avec l'œil** : c'était un VRAI `<Link>` vers
> `/park/{parc}/ride/{slug}`, donc « copier l'adresse du lien » et Ctrl+clic. Un
> `<a>` ne peut pas envelopper le nom sans casser le collage du chevron (élément
> interactif imbriqué), et une ligne cliquable est un `<div>`. Les liens profonds
> eux-mêmes restent actifs (mails d'alerte, page `/ride/...`, `initialRideId`) —
> voir les **deux pièges** (préchargement, NextTopLoader) dans « Liens profonds
> attraction ». Le chargement de l'historique vit dans `hooks/useRideHistory.ts`.

> **Nom + icônes, jamais séparés** : le nom de l'attraction est découpé en
> « début » + « dernier mot » (helper partagé `splitGluedTail`), et ce dernier
> mot est rendu dans le même `whitespace-nowrap` que le chevron et la cloche. Sur
> mobile, les icônes se retrouvaient sinon **seules sur une ligne**, sans texte.
> Quand la place manque, c'est donc le dernier mot qui part à la ligne avec
> elles. Garde-fou : au-delà de `MAX_GLUED_TAIL = 18` caractères, le dernier mot
> ne serait plus sécable et déborderait de la colonne → on repasse au flux
> normal. Même découpage côté spectacles.
>
> ⚠️ **Les lignes de files secondaires (dépliées) suivent la MÊME règle**
> (2026-07-30). Elles étaient en `flex items-center gap-1 ps-6` : un libellé sur
> deux lignes laissait son icône de type (`FastForward`/`User`/`Clock`) centrée
> verticalement **à côté** du bloc, détachée du texte — très visible sur mobile.
> Elles sont donc passées au même **flux inline** que la ligne standby, icône
> collée au dernier mot. Le retrait `ps-6` a disparu du même coup : la flèche
> `CornerDownRight` part désormais du **même bord gauche que les noms
> d'attraction** et le libellé se colle à elle (`me-0.5`). La hiérarchie se lit à
> la flèche et à la couleur atténuée, pas à un décalage qui désalignait la
> colonne.

> **Cloche `BellRing` en bout de nom** = une alerte est armée sur cette
> attraction (rappel programmé côté spectacles). Purement informative, alimentée
> par le `NotificationsProvider` (voir plus bas). Espacement : `ms-0.5` derrière
> le chevron (son padding fait déjà l'espace), `ms-1.5` s'il n'y a pas de chevron.

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
- ⚠️ **Un TROU de la prévision doit rompre la courbe** (2026-08-05). Le worker
  n'émet aucun point sur les créneaux « habituellement fermés » — un trou
  délibéré plutôt qu'un 0 trompeur. Mais `connectNulls={false}` ne rompt que sur
  un `null` EXPLICITE, pas sur une ligne absente du tableau : recharts reliait
  les deux bords du trou par un segment franc, sur lequel aucun point ne répond
  au survol. Vu sur Aerophile (Disney Springs) : 20 points au pas de 15 min,
  **un trou de 8 h 30 entre 13:00 et 21:30**, et une courbe qui annonçait
  « 0 min » sans interruption de 10:00 à 23:00. `wait-time-chart.tsx` insère
  donc une ligne vide au milieu de chaque écart supérieur à 1,5 pas.
  ⚠️ Le pas de référence est le plus PETIT écart de la série, jamais une
  constante : il varie d'une attraction à l'autre, et le déduire des données
  évite qu'un changement de cadence côté worker ne rouvre le trou.
  ⚠️ La rupture n'est ajoutée que si l'intervalle ne porte **aucune** ligne :
  une ligne déjà présente vient de la courbe observée, sa prévision y est donc
  nulle — la rupture existe, et en ajouter une couperait la courbe observée en
  deux.
- ⚠️ **La courbe observée doit atteindre la FERMETURE.** La grille de buckets
  s'arrête *avant* `close` : une journée terminée voyait donc sa courbe s'arrêter
  jusqu'à un pas complet trop tôt (fermeture 19:30 → dernier point 19:15) alors
  que l'axe, lui, va jusqu'à 19:30 — impossible de savoir le temps affiché en fin
  de journée. `sampleDaySeries` ajoute donc un point de fermeture, **uniquement
  quand la journée est finie** (en cours de journée la courbe s'arrête à
  « maintenant », la prévision prend le relais). Ce point est échantillonné en
  `inclusiveEnd` : l'attraction qui bascule « fermée » à l'heure pile laisserait
  sinon un dernier point vide, alors que la question est justement « quel temps
  affichait-elle en fermant ? ».
- ⚠️ **`chronicallyUnavailable` n'est pas qu'un message** : il DÉSACTIVE aussi les
  alertes de l'attraction. Il exige donc `observedDays >= 3`
  (`MIN_OBSERVED_DAYS_FOR_UNAVAILABLE`) en plus de `availabilityRatio < 0.2`.
  **`observedDays`, surtout pas `historyDays`** (2026-07-30) — les deux viennent
  du `baseProfile` du worker mais ne comptent pas la même chose :
  `observedDays` = journées où l'attraction a été **vue**, ouverte ou non ;
  `historyDays` = journées où elle a été **disponible** au moins une fois.
  La première version du garde-fou testait `historyDays >= 3` et **s'annulait
  elle-même** : une attraction qui n'affiche JAMAIS de temps (Eurosat
  Coastiality) a par construction `historyDays = 0`, donc elle échappait au
  verdict et laissait créer des alertes qui ne se déclencheraient jamais. Seul
  `observedDays` sépare les deux cas qu'on veut distinguer — parc fraîchement
  ajouté (0, on ne conclut rien, cf. PortAventura et ses 46 lignes
  `ride_forecast` à `historyDays: 0`) vs attraction suivie depuis des semaines
  sans jamais publier d'attente (élevé). Second garde-fou côté popup : si
  l'attraction affiche un temps d'attente **en ce moment**, le direct tranche
  contre l'historique et l'alerte reste possible.
- **Formulation des messages** : « indisponible » était faux pour une attraction
  qui ne publie simplement pas d'attente. `chartUnavailablePermanent` et
  `alertsUnavailable` disent donc « **cette attraction ne communique pas de
  temps d'attente** » (donc ni direct, ni prévision, ni alerte).
  `chartUnavailable` (« indisponible pour le moment ») reste réservé au vrai cas
  du jour : des données existent aujourd'hui mais aucun temps dedans.
- **Pas de badge de « fiabilité ».** `meta.confidenceLevel` est toujours renvoyé
  par l'API mais **n'est plus affiché** : il mesure le VOLUME de données
  disponibles (`0.2 + 0.08 × jours + 0.3 × recouvrement`), pas la justesse réelle
  de la prévision — ce qui rendait « Fiabilité : haute » systématique dès 7 jours
  d'historique. `chart-section.tsx` affiche à la place une mention neutre
  **« Estimation »** avec un tooltip (`attractionDetail.estimateTooltip`), plus la
  note « mise à jour à l'ouverture » si `preOpening`.
- **Marge d'erreur « X min » — TEXTE SEUL, plus de bande (2026-07-30)** :
  - Elle remplace ce que le badge de fiabilité prétendait dire, cette fois
    **mesurée** : le worker confronte chaque jour ses prévisions à l'observé
    (table `forecast_accuracy`, cf. AI_CONTEXT du worker) et en déduit une marge
    par fenêtre d'horizon. `meta.marginMinutes`/`marginSamples` donnent la valeur
    agrégée, seule chose affichée aujourd'hui.
  - ⚠️ **La bande d'incertitude autour de la courbe a été SUPPRIMÉE** : plus
    d'`Area` de plage `dataKey="band"`, plus d'entrée de légende, plus de mention
    dans le tooltip, plus de marges factices dans la démo À propos. Le graphique
    est donc revenu de `ComposedChart` à **`LineChart`** (le `ComposedChart`
    n'existait QUE pour accueillir l'`Area`) — ne pas le remettre sans raison.
  - Ce qui reste : une phrase sous le graphique, `attractionDetail.marginNote`,
    « Sur les derniers jours, nos prévisions se sont trompées de **X min** en
    moyenne. » Seule la **valeur** porte une infobulle (`marginNoteTooltip`,
    souligné pointillé via `t.rich` + balise `<v>`) qui explique d'où sort ce
    chiffre — souligner la phrase entière ferait d'un texte de bas de graphique
    un gros bloc cliquable. L'infobulle tient en **une phrase** (`max-w-[13rem]`) :
    elle sert à lever un doute sur l'origine du chiffre, pas à documenter le
    moteur — les détails (repli sur le parc, arrondi au pas de l'attraction)
    alourdissaient une bulle qui doit se lire d'un coup d'œil.
  - Conséquence : la condition d'affichage porte sur `meta.marginMinutes` et non
    plus sur la présence d'une `margin` point par point ; il n'y a plus de bande
    avec laquelle rester cohérent. Les points de `forecast` portent toujours leur
    `margin` dans la réponse de l'API — le graphique l'ignore, simplement.
  - ⚠️ Les marges ne regardent que les journées **passées** : le jour de la mise
    en service, aucune attraction n'affiche de chiffre (ce n'est pas une panne).
    Elles sont un **multiple du pas de l'attraction** (worker, `valueStepOf` /
    `snapMargin`) : pas de « ± 7 min » sur une attraction qui n'affiche que des
    multiples de 5.

### Météo (ajout 2026-07)

- La route `GET /api/park/[parkId]` renvoie `weather: ParkWeather | null` :
  météo **courante** (`currentTemp`/`currentWeatherCode`, lus sur la ligne
  `Park`, remplis par le worker) + min/max du jour (`daily_weather`).
  `null` si ni courant ni prévision.
- Affichage : `components/parks/park-weather.tsx` dans le header du parc, sur la
  ligne de l'heure sur place, séparé par une **puce `•`** : « 🕐 17:52 • ☀ 32°C ».
  Les deux décrivent le même instant, et **le libellé a été supprimé** (2026-07-29,
  clé `parkPage.localTime` retirée des 14 locales) : l'horloge désigne une heure,
  la météo qui suit dit assez qu'on parle de maintenant. Icône `lucide` mappée
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

### Pastille d'état d'un parc — le trou de minuit (2026-08-10)

`getParkStatus` (`lib/utils.ts`) rend `unknown` dès que la liste d'horaires est
VIDE, et `unknown` **n'affiche rien du tout** : ni pastille dans les listes
(`getParkStatusDot`), ni badge sur la page parc (`ParkStatusBadge`). Un parc
sans donnée était donc indiscernable d'un bug de rendu.

Or il y a un moment où la donnée manque, chaque nuit, pour chaque parc : les
horaires du jour sont écrits par le passage horaire du worker qui **suit minuit
LOCAL** (mesuré sur une semaine : entre 00:00 et 00:08 heure du parc), et
`getParksWithHours()` mémorise la liste **5 min** de plus. Constaté en vrai à
00:12 heure de Shanghai — parcs chinois sans pastille, pendant que le Japon,
minuit passé depuis plus d'une heure, affichait bien les siennes en rouge.

`fetchOpeningHoursForParks` **retombe donc sur la veille** quand la journée
résolue n'a aucune ligne — sous TROIS verrous :

1. `now.hour < SAFE_AFTER_CLOSE_HOUR`, testé **explicitement** dans le repli et
   pas seulement déduit d'`orFilters` (qui ne charge la veille que dans cette
   tranche). Élargir un jour le chargement ne doit pas élargir le repli par
   effet de bord ;
2. `resolvedDate !== yesterday` — un parc encore ouvert après minuit a DÉJÀ la
   veille comme journée logique, il n'y a rien à replier ;
3. conséquence des deux : la veille a forcément fermé avant minuit, donc le
   repli **ne peut produire que « fermé »**. Il ne peut pas allumer une
   pastille verte à tort.

⚠️ **Le point 1 est le garde-fou qui compte.** Un parc dont les horaires
manquent à MIDI ne doit surtout pas hériter de ceux de la veille : à cette
heure-là ils affirmeraient un état sans rien savoir de la journée en cours, et
un parc qui a changé ses horaires afficherait ceux d'hier. Hors de la nuit, pas
de donnée = pas de pastille, comme avant.

⚠️ **Le repli ne vaut QUE pour `ParkList`** (accueil, recherche), où
`openingHours` ne sert qu'à calculer la pastille et n'est jamais affiché en
clair. La page parc passe par `buildParkLiveData`, qui **affiche** ses horaires
(`components/parks/opening-hours.tsx`, JSON-LD) : y replier sur la veille
publierait de faux horaires. Elle garde donc son trou de quelques minutes —
c'est délibéré, la corriger demanderait de séparer « horaires pour l'état » et
« horaires à afficher ».

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

#### Deux natures d'alerte : seuil et réouverture (2026-08-14)

`Alert.type` (`threshold` | `reopen`) — **l'état de l'attraction décide**, jamais
l'utilisateur. Ouverte → seuil de temps d'attente. En panne / maintenance /
fermée → réouverture. Les deux ne coexistent pas (`@@unique userId+rideId`), et
c'est le point : chacune est **muette** dans le cas de l'autre. Une alerte de
seuil sur une attraction arrêtée attend un temps qui n'est pas publié ; une
alerte de réouverture sur une attraction ouverte attend une transition déjà
passée. `alertModeFor()` (`alert-section.tsx`) choisit, et `POST /api/user/alerts`
**revérifie l'état réel en base** et répond 409 si l'attraction a changé entre
l'ouverture du popup et l'envoi — sinon on enregistrerait une alerte morte-née.

⚠️ **Cycle de vie différent, et c'est voulu.** Une alerte de seuil qui notifie est
SUPPRIMÉE ; une alerte de réouverture est seulement DÉSACTIVÉE et sa ligne
survit jusqu'au soir. Sans cette ligne, le **réarmement automatique** n'aurait
plus rien à réarmer : si l'attraction retombe à l'arrêt dans l'heure
(`REOPEN_REARM_WINDOW_MS`), le moteur remet l'alerte en veille tout seul et
**envoie un push qui le dit** — la notification précédente annonçait l'inverse,
la taire laisserait l'utilisateur croire son attraction ouverte. Au-delà d'une
heure on ne touche à rien : c'est un événement nouveau, pas la suite du précédent.

Conséquence sur le moteur : `runAlertsPass` lit désormais **toutes** les alertes,
plus seulement `active: true`. L'expiration quotidienne (fuseau du parc) est
évaluée AVANT l'aiguillage par type, donc elle balaie aussi les réouvertures
consommées — sans quoi elles traîneraient jusqu'à la purge de rétention à 7 jours.

##### La fin de journée est indiscernable d'une panne (`lib/park-closing.ts`)

Le piège central de cette fonctionnalité. `closed` est exclu de
`REOPEN_REARM_STATUSES` (= `down` + `maintenance`) parce qu'à la fermeture,
TOUTES les attractions y passent — mais **ça ne suffit pas** : selon les parcs,
une attraction qui s'arrête pour la nuit reste en `down` ou en `maintenance`,
donc DANS la liste. Le statut ne peut pas trancher.

C'est l'**horaire du parc** qui tranche. `lib/park-closing.ts` porte la règle
(module PUR, donc importable côté client) ; `lib/park-closing-db.ts` charge les
horaires quand l'appelant ne les a pas déjà. Trois états, et la distinction
compte : `unknown` (aucun horaire publié) **autorise**, il ne vaut surtout pas
`closed` — beaucoup de parcs ne publient pas leurs horaires, les traiter comme
fermés supprimerait la fonctionnalité chez eux sans qu'aucun signal ne l'indique.

Deux marges, **volontairement différentes** :

| | Marge avant fermeture | Coût d'une erreur |
|---|---|---|
| Création (`REOPEN_CREATE_CLOSING_MARGIN_MS`) | 1 h | une alerte simplement muette |
| Réarmement (`REOPEN_REARM_CLOSING_MARGIN_MS`) | 2 h | **un push** annonçant une panne qui n'en est pas une |

L'asymétrie ouvre une zone (1 h–2 h avant la fermeture) où l'alerte peut être
créée mais plus réarmée automatiquement. C'est assumé : elle peut toujours
NOTIFIER une vraie réouverture jusqu'à la fermeture, et c'est là l'essentiel.

⚠️ Les trois appelants doivent rester d'accord, d'où la règle partagée : le
formulaire (`main-card.tsx` → prop `reopenAllowed` → `AlertSection`), la route de
création (409 `Park is closing`) et le moteur. Si l'UI proposait un bouton que la
route refuse ensuite, l'utilisateur ne verrait qu'un échec inexplicable.

Le réarmement automatique **ne recale pas `activeDate`** : il ne doit pas
prolonger la validité de l'alerte au-delà de la journée d'origine. Et il n'écrit
**pas** dans `AlertHistory` — ce journal recense les alertes REMPLIES, celle-ci
repart en veille.

`Alert.threshold` et `AlertHistory.threshold` sont passés **nullables** plutôt que
« 0 par convention » : un 0 s'afficherait « ≤ 0 min » partout où l'on oublierait
le cas, là où `null` force le compilateur à trancher à chaque point d'affichage.

##### Le popup suit le direct (`wait-time-table.tsx`)

`ParkWaitTimeTable` retient l'**identifiant** de l'attraction ouverte
(`detailRideId`), plus son objet. Auparavant `detailTarget` était une PHOTO prise
au clic, que le rafraîchissement 60 s ne mettait jamais à jour : le popup pouvait
afficher « En panne » alors que l'attraction avait rouvert — et surtout proposer
l'alerte correspondant à cet état périmé, que la route aurait ensuite refusée en
409. En repartant de l'identifiant, `liveDetailTarget` est relu à chaque
rafraîchissement et **le formulaire bascule tout seul** de « réouverture » à
« seuil » sous les yeux de l'utilisateur (`AlertSection` re-sème alors le
sélecteur avec le temps d'attente qui vient d'apparaître, via un effet dépendant
du seul `mode` — suivre `defaultThreshold` écraserait le choix manuel chaque
minute).

`lastDetailTarget` (ref, écrite dans un effet et **jamais pendant le rendu**) sert
de filet si l'attraction disparaît du flux : le popup garde ce qu'on avait au
lieu de se vider sous les doigts. Le graphique, lui, était déjà vivant —
`useRideHistory` interroge `/history` toutes les 60 s (`force-dynamic`, aucun
cache), et ses dépendances sont des primitives (`rideId`, `parkIdentifier`), donc
la nouvelle référence d'objet à chaque rafraîchissement ne le relance pas.
- **Auto-refresh** : `hooks/useAutoRefresh.ts` gère lui-même la visibilité de
  l'onglet (un seul intervalle 1 s, arrêté quand l'onglet est caché, rattrapage
  au retour). `usePageVisibility` a été supprimé.
  ⚠️ **Le décompte part du dernier FETCH CLIENT** (`nextRefreshAt`, replanifié
  dans le `finally` de chaque tentative — succès comme échec), et surtout PAS de
  `park.lastUpdate`. Le hook prenait auparavant cet horodatage en paramètre : or
  c'est `parks.lastUpdatedAt`, que le worker n'écrit **que si son fetch
  réussit**. Une source qui tombe (ou la nuit, ou une Schedule Dokploy qui
  patine) le figeait, le décompte plongeait sous la fenêtre `-20 s` de
  déclenchement et **plus rien ne se rafraîchissait jamais** — pas même au retour
  d'onglet, puisque rafraîchir ne changeait pas la valeur de référence. D'où
  l'impression de blocage. La fenêtre `-20` n'existe plus (elle n'avait de sens
  que pour cet horodatage-là).
  `park.lastUpdate` ne sert plus qu'à **afficher la fraîcheur de la donnée** :
  au-delà de `STALE_DATA_MS = 10 min` (`main-card.tsx`), on affiche « Dernière
  mise à jour : … » à la place du décompte — c'est une info sur la donnée, pas un
  état d'échec ; le cycle continue de tourner derrière. ⚠️ Ce test est gardé par
  un `mounted` : `Date.now()` diffère entre Node et le navigateur, un
  `lastUpdate` pile sur le seuil provoquerait une erreur d'hydratation.
- **⚠️ `Intl` et hydratation** : `Intl.DisplayNames` s'appuie sur les données ICU
  du runtime, et Node ≠ navigateur (`HK` → « Hong Kong SAR China » côté Node,
  « Hong Kong » côté Chrome). Depuis que l'accueil est rendu côté serveur, tout
  appel pendant le rendu d'un composant client provoque une erreur
  d'hydratation. Le nom de pays est donc résolu **côté serveur** ;
  `getCountryName` ne doit jamais être appelée depuis un composant client. Même
  piste pour `toLocaleLowerCase()`/`toLocaleDateString()` sans locale explicite :
  ils dépendent de la locale par défaut du runtime.

### Deux noms de pays, et il faut les distinguer (2026-08-05)

- **`ParkList.countryName` est ANGLAIS et le reste**, quelle que soit la langue
  du visiteur : ⚠️ ce n'est pas un libellé d'affichage, c'est la **clé du
  drapeau** — `getCountryFlagClass` en tire `twa-flag-united-states`. Le
  traduire effacerait tous les drapeaux d'un coup.
- **`ParkList.countryLabel` est le libellé traduit**, et c'est lui qu'affiche le
  regroupement « par pays » de `parks-list.tsx`. Avant, la liste sortait
  « Germany » et « United States » dans les 14 langues.
- ⚠️ **La traduction se fait HORS DU CACHE** (`localizeCountries`, appelée par
  `app/[locale]/page.tsx`). La liste des parcs est mémorisée 5 min **pour tout
  le monde** : y ranger un libellé traduit servirait la langue du premier
  visiteur aux treize autres pendant cinq minutes. Le cache reste neutre, la
  traduction se refait par requête — un `Intl.DisplayNames` et deux cents
  lectures de Map.
- ⚠️ `/api/parks` ne porte **pas** `countryLabel`, et c'est volontaire : elle est
  servie derrière un `s-maxage=60` **partagé**, donc une réponse traduite y
  serait distribuée à toutes les langues. Elle n'a plus d'appelant côté client
  depuis le passage au rendu serveur ; si un besoin réapparaît, il faudra une
  clé de cache par langue (`?locale=`), pas un simple champ de plus.
- ⚠️ **Le tri des catégories n'utilise PAS `localeCompare`** : il passerait par
  les données de collation du runtime, soit exactement l'écart Node ↔ navigateur
  qui a déjà coûté des erreurs d'hydratation sur ces mêmes noms. La clé de tri
  est un dépliage `NFD` sans diacritiques, déterministe partout — et qui range
  au passage « Émirats arabes unis » à E, là où le tri par point de code le
  renvoyait après Z.
- **Accessibilité** : `wait-time-table.tsx` n'est pas un `<table>` (blocs animés)
  mais porte les rôles ARIA `table`/`rowgroup`/`row`/`columnheader`/`rowheader`/
  `cell` + `aria-sort`. Toute nouvelle ligne doit conserver cette structure.

## Conventions

- Composants avec état/hooks/browser → `"use client"`. Pages `page.tsx` de route
  = server components qui exportent `generateMetadata` puis rendent un client.
- `cn()` (`lib/utils`) = clsx + tailwind-merge ; passer des classes qui écrasent
  les défauts (ex. `Card` a `py-6 gap-6 rounded-xl`, surchargeable).
- `components/parks/main-card.tsx` **n'est pas une carte malgré son nom** :
  c'est la COLONNE de cartes de la page parc (onglets, événement, attractions,
  demain restaurants et files virtuelles). Elle se lit comme UN BLOC TRANCHÉ :
  `stackRadius(isFirst, isLast)` pose `rounded-lg` sur les jointures et
  `rounded-t-4xl`/`rounded-b-4xl` aux deux bouts — la carte des onglets en est
  le premier maillon, et `EventCard`/`SectionCard` reçoivent leurs angles par
  `className` (elles ignorent leur place dans la pile).
  ⚠️ **L'INTÉRIEUR du sélecteur SUIT sa carte, angle par angle** (2026-08-25),
  au lieu du `rounded-3xl` uniforme d'avant qui gardait le même coin partout —
  y compris en bas, où la carte n'a que sa jointure de pile. La géométrie vit
  dans `TAB_GEOMETRY` / `TAB_LIST_RADIUS` / `TAB_PILL_RADIUS` (variables CSS +
  `calc()`), pour que les rayons se DÉDUISENT du padding au lieu d'être figés à
  côté de lui — deux couches (carte → liste → pastille) et deux tailles d'écran.
  - **En haut, concentrique** : `rayon extérieur − épaisseur traversée`, soit
    32 px moins le padding de la carte, puis moins les 3 px de la `TabsList`.
  - **En bas, la même règle mais avec un PLANCHER** (`--tab-r-floor`, 4 px).
    La carte n'y a que 10 px de jointure, plus fin que les 8 + 3 px de padding
    cumulés : la soustraction tombe à −1 px, un rayon négatif invalide la
    déclaration CSS, et le coin finit droit dans un angle arrondi. Reprendre
    tel quel le rayon extérieur ne marche pas davantage — à rayon égal, l'arc
    intérieur, plus petit, se lit plus GRAS que celui du bord. Aucune valeur
    n'est idéale : le plancher est l'arbitrage, et il s'efface dès que le
    calcul repasse au-dessus.

  ⚠️ Les classes sont écrites EN TOUTES LETTRES, jamais assemblées par template
  literal : Tailwind scanne les sources comme du texte, et une classe construite
  à l'exécution ne génère aucun CSS — sans erreur au build.
- `section-card.tsx` = carte TITRÉE, cousine sobre d'`event-card.tsx` (même
  géométrie d'en-tête, sans état ni repli ni teinte). **Le titre nomme la
  SOURCE, pas l'onglet** (« Attractions », pas « Temps d'attente ») : c'est ce
  qui tiendra quand l'onglet en portera quatre. La colonne « Attraction » de la
  table s'appelle donc `waitTimeTable.name` (« Nom ») depuis le 2026-08-21.
- Les onglets se partagent la colonne par NATURE, pas par source :
  `tabs.live` (vrai à l'instant T) et `tabs.schedule` (ce qui a un horaire),
  d'où leur renommage depuis `waitTimes`/`shows`. Pastille coulissante
  iOS-like, motif repris par la page À propos.
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
  ⚠️ `ForecastDemo` réutilise le VRAI `WaitTimeChart`. Sa vignette n'est plus
  `wide` (2026-07-30) : une seule carte à cheval sur deux colonnes cassait la
  grille. Le graphique passe donc en prop **`compact`** (hauteur 132 px au lieu
  de 180, axe Y plus étroit, police 10 px et au plus **3** intervalles horaires
  au lieu de 5) — sans ça, 6 libellés d'heure ne tiennent pas dans la largeur
  d'une vignette. `compact` est un vrai prop du composant partagé, pas une copie
  du graphique : le popup reste la référence.
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
  `alerts` (+`/[id]`, `/history`), `show-reminders` (+`/[id]`, `/history`),
  `notifications` (DELETE = remise à zéro), `push`.
- **UI** : bloc accueil `components/home/user-block.tsx` (au-dessus des favoris),
  popup `components/auth/auth-dialog.tsx`, page `app/[locale]/profile/` +
  `components/profile/*`. La **page profil est calquée sur la page À propos**
  (header `ScrollShrinkHeader` partagé + carte à onglets `rounded-4xl` : onglets
  Alertes / Préférences). Onglet **Alertes** = **fil unifié** (`AlertsSection`) :
  sous-onglets **Actives / Historique** + filtre **Tout · Attractions ·
  Spectacles** (le type = attribut de ligne : pastille `RollerCoaster` vs
  `Drama`), une seule liste pleine largeur. Onglet **Préférences**
  = **contrôles tactiles** (`PreferencesCard`) : thème en **3 vignettes** (soleil
  / lune / écran), heure en **interrupteur segmenté** 24 h/12 h, langue en menu.
  En tête : **3 vignettes** cliquables (parcs favoris
  `x/20`, attractions favorites, alertes actives) → popups favoris.
  Squelette : `components/profile/profile-skeleton.tsx`
  (affiché tant que la session charge).
- ⚠️ **L'onglet Alertes est en LECTURE SEULE** (2026-07-28) : ni création, ni
  modification, ni suppression, ni (dés)activation — plus de Switch, de crayon ni
  de corbeille, plus de popups d'édition seuil/délai. Il ne reste que la pastille
  de type, le nom, le parc et le badge de valeur. **Tout se règle depuis le popup
  de l'attraction ou du spectacle**, seul endroit qui montre le contexte (temps
  d'attente courant, horaires des représentations) ; un second jeu de contrôles
  n'était qu'un doublon à maintenir. Le sous-onglet « Actives » ne liste que les
  alertes `active` (celles qui ont notifié sont supprimées, celles expirées avec
  la journée n'ont plus rien à y faire). `PATCH /api/user/alerts/[id]` n'a donc
  plus d'appelant (le `DELETE` de la même route sert toujours au popup).
- **Remise à zéro** (`privacy-section.tsx`, au-dessus de la suppression de
  compte) : `DELETE /api/user/notifications` vide en UNE `$transaction` les
  quatre tables `Alert` / `AlertHistory` / `ShowReminder` / `ShowReminderHistory`
  de l'utilisateur — à moitié effacé, l'état serait incohérent. Compte,
  préférences et favoris intacts. Confirmation par simple dialogue (pas de
  recopie d'e-mail comme pour le compte : c'est irréversible mais réparable),
  bordure neutre + bouton contour rouge, le bloc rouge plein restant réservé à la
  suppression du compte. i18n `privacy.resetAlerts*`.
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
- ⚠️ **L'heure d'une représentation s'affiche dans le fuseau DU PARC.** La base
  utilisateurs ne stocke que `parkIdentifier` : les routes `show-reminders`
  (+`/history`) résolvent le `timezone` depuis la base principale (une requête
  pour tous les parcs cités, même motif que la résolution des noms de parcs) et
  le posent sur le DTO (`timezone: string | null`, `null` = parc introuvable →
  repli navigateur). Sans ça, le profil affichait « 08:35 » pour un spectacle de
  23:35 à Disneyland California. ⚠️ En revanche `sentAt` (réception de la
  notification) reste dans le fuseau du LECTEUR : c'est un moment qu'il a vécu.
  ⚠️ `ShowReminderHistory` : penser à `npm run user:generate` + `user:push`.
- i18n : namespaces `userBlock`, `auth`, `profile`, `alerts` (fr+en).

## Aperçu admin des parcs masqués (2026-08-25)

Un parc dont `parks.display = false` reste invisible de tous — sauf des comptes du
SITE portant `users.isAdmin` (base UTILISATEURS, colonne ajoutée par
`prisma/user/manual/2026-08-25-user-is-admin.sql`), qui voient sa page à son URL
normale, comme s'il était publié. C'est ce qui permet de vérifier une couverture,
un badge ou des horaires avant la mise en ligne, au lieu de publier pour voir.

⚠️ **Ce n'est PAS le compte de l'admin panel.** `tw-waittimes-admin` a sa propre
table `users` dans la base PRINCIPALE (bcrypt) ; celle-ci est celle du site
(Auth.js). Les deux bases sont disjointes et l'admin ne se connecte pas à la
seconde : le drapeau se pose avec `npm run make-admin -- <email>` (`--off` pour le
retirer), sur un compte **déjà créé**, c'est-à-dire connecté au moins une fois.
Sessions en base : le retrait prend effet sans reconnexion.

- `resolveParkForViewer()` / `buildParkLiveDataForViewer()`
  (`lib/park-live-data.ts`) sont un **repli**, pas un contournement : la version
  filtrée est tentée d'abord, et **la session n'est lue que si le parc est
  introuvable**. Un visiteur d'un parc publié — y compris à chacun de ses
  rafraîchissements de 60 s — ne déclenche donc aucune requête de session. C'est
  la raison de la forme en deux temps plutôt qu'un `includeHidden` que chaque
  appelant calculerait.
- ⚠️ `getParkIdentity` / `buildParkLiveData` sont mémoïsés par `cache()` et
  **`includeHidden` fait partie de la clé** : mélanger les deux formes dans une
  même requête émet deux fois la requête SQL.
- Câblé sur : la page parc (+ `robots: noindex` quand le parc est masqué), la
  page lien profond attraction, `GET /api/park/[parkId]` et
  `GET /api/park/[parkId]/ride/[rideId]/history`. ⚠️ **La route de
  rafraîchissement n'est pas optionnelle** : `park-page-client` renvoie à
  l'accueil sur un 404, la page s'ouvrirait donc pour se refermer 60 s plus tard.
- **Hors périmètre, volontairement** : l'accueil, la liste des parcs et
  `app/sitemap.ts` — un parc masqué y reste absent même pour un admin. Les deux
  `opengraph-image.tsx` non plus (`revalidate = 900` : rendus hors requête, sans
  cookie à lire), donc image de partage de repli, assumé.
- `components/parks/hidden-park-notice.tsx` : pastille flottante **en bas**, pas
  un bandeau en tête — l'en-tête du parc est `fixed z-50` et passerait dessus.
  Texte non traduit à dessein (seuls les admins le voient ; un namespace pour une
  phrase coûterait quatorze fichiers de messages).

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
  ⚠️ Un client périmé se manifeste AUSSI par une erreur SQL trompeuse du genre
  « `The column show_reminders.sent does not exist` » : ce n'est pas la base qui
  est en retard, c'est le client qui sélectionne encore une colonne supprimée du
  schéma. Réflexe : `npm run user:generate` (et `npx prisma generate` pour la base
  principale) avant de chercher plus loin — ça règle du même coup les erreurs
  `tsc` du type « Property 'rideForecast' does not exist ».

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
  une par attraction) — l'historique reste par alerte.
- ⚠️ **Une alerte est à USAGE UNIQUE** (2026-07-28) : après l'écriture dans
  `alert_history`, le moteur la **SUPPRIME** (avant : `active=false`). Elle avait
  atteint son objectif, et le profil ne propose plus de la réactiver. Effet de
  bord bienvenu : plus de notification répétée quand le temps oscille autour du
  seuil. L'historique survit (relation `Alert → AlertHistory` en
  `onDelete: SetNull`). Même schéma que les rappels de spectacles, qui écrivent
  dans `ShowReminderHistory` puis se suppriment.
- ⚠️ **Expiration quotidienne = SUPPRESSION** : une alerte ne vaut QUE pour le
  jour de sa création. `Alert.activeDate` est calé sur « maintenant » à la
  création / au changement de seuil ; passé **minuit dans le fuseau du parc**
  (jointure `ride → park.timezone` — pas celui du serveur ni de l'utilisateur), le
  moteur la supprime. Rien à journaliser : ces alertes-là n'ont jamais notifié.
  La purge à 7 jours en tête de passe n'est plus qu'un **filet** pour d'anciennes
  lignes désactivées (la boucle d'expiration ne lit que les actives).
  ⚠️ Cas connu, assumé : pour un parc qui ferme **après** minuit, l'alerte
  disparaît alors que le visiteur est encore sur place. Le « jour logique » du
  worker (`getParkLogicalDate`) serait la variante à retenir si on veut la tenir
  jusqu'à la fermeture réelle.
- **Corbeilles** : même style partout (`variant="ghost"` +
  `text-destructive hover:text-destructive`), popups attraction et spectacle
  compris — c'est désormais le SEUL endroit où l'on supprime.
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
