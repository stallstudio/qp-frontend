"use client";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { AlertCircle, CalendarClock, Loader2, Radio } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  AnimatePresence,
  motion,
  useReducedMotion,
  type Variants,
} from "motion/react";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";
import { useParkStream } from "@/hooks/useParkStream";
import { useDataAge } from "@/hooks/useDataAge";
import ParkWaitTimeTable from "./wait-time-table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { useEffect, useId, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ParkLiveData } from "@/types/api";
import type { WaitTime } from "@/types/waitTime";
import type { PoiHours, PoiHoursSlot } from "@/types/poiHours";
import {
  parkOpenWindowFrom,
  reopenAllowedForWindow,
  REOPEN_CREATE_CLOSING_MARGIN_MS,
} from "@/lib/park-closing";
import {
  alertOpeningHours,
  dayOpeningHours,
  parkOpensToday,
  visibleParkEvents,
} from "@/lib/park-events";
import ParkShowTimeTable from "./show-time-table";
import PoiStatusTable from "./poi-status-table";
import PoiHoursTable from "./poi-hours-table";
import { PoiHoursProvider } from "./poi-hours-context";
import EventCard from "./event-card";
import FamilySwitcher from "./family-switcher";
import {
  LIVE_FAMILIES,
  POI_KIND_ICONS,
  SCHEDULE_FAMILIES,
  isLiveFamily,
  isScheduleFamily,
  type LiveFamily,
  type ParkFamily,
  type ScheduleFamily,
} from "@/lib/poi-kinds";

type MainCardProps = {
  park: ParkLiveData;
  /** Recharge les données et rend le `nextUpdateIn` annoncé par le serveur —
   *  c'est lui qui fixe l'échéance du cycle suivant (voir `useAutoRefresh`). */
  onRefresh?: () => Promise<number | null | undefined>;
  // Lien profond vers une attraction : force l'onglet « temps d'attente » et
  // demande à la table d'ouvrir le popup correspondant.
  initialRideId?: number | null;
};

// Le titre de la carte de chaque famille, dans `parkPage.cards`.
//
// ⚠️ Une TABLE et non `tCards(kind + "s")` : `next-intl` exige des clés
// littérales pour que l'outillage sache dire quelle traduction manque, et un
// pluriel fabriqué par concaténation ne tient pas d'une langue à l'autre.
const CARD_TITLE_KEYS: Record<ParkFamily, string> = {
  ride: "attractions",
  show: "shows",
  restaurant: "restaurants",
  shop: "shops",
  hotel: "hotels",
  service: "services",
};

// Les familles de l'onglet « Horaires du jour » dont les horaires sont des
// heures d'ouverture (`poi_hours`), par opposition aux spectacles et à leurs
// représentations (`show_times`).
type HoursFamily = Exclude<ScheduleFamily, "show">;

// Les deux onglets de la colonne, sous la `value` que Radix leur donne.
type ColumnTab = "wait-times" | "show-times";

// ————— Changer de famille : la colonne glisse vers la pastille choisie —————
//
// `direction` vaut 1 quand on choisit une pastille plus à droite, -1 plus à
// gauche : la nouvelle liste arrive du côté où l'on a tapé, l'ancienne part de
// l'autre, comme une page qu'on tourne.
//
// ⚠️ **Opacité et translation seulement**, pas de flou ni d'échelle : la carte
// des attractions d'un grand parc aligne cinquante lignes, et un `filter`
// recalculé sur toute sa hauteur pendant l'animation saccade sur un téléphone
// d'entrée de gamme.
const FAMILY_SLIDE: Variants = {
  enter: (direction: number) => ({ opacity: 0, x: direction * 28 }),
  center: {
    opacity: 1,
    x: 0,
    transition: {
      x: { type: "spring", bounce: 0, duration: 0.45 },
      opacity: { duration: 0.2 },
    },
  },
  exit: (direction: number) => ({
    opacity: 0,
    x: direction * -28,
    transition: { duration: 0.14, ease: "easeIn" },
  }),
};

// « Réduire les animations » : le changement reste perceptible, sans mouvement.
const FAMILY_FADE: Variants = {
  enter: { opacity: 0 },
  center: { opacity: 1, transition: { duration: 0.15 } },
  exit: { opacity: 0, transition: { duration: 0.1 } },
};

// Au-delà de ce délai sans écriture du worker, on affiche l'horodatage des
// données plutôt que le décompte (voir `dataIsStale`).
const STALE_DATA_MS = 10 * 60_000;

// ————— Géométrie de la colonne —————
//
// ⚠️ **Toutes les cartes de la page ont le MÊME grand arrondi** — 2 rem, celui
// de l'en-tête du parc (arbitré le 2026-10-06). La colonne se lisait jusque-là
// comme un ticket découpé : gros arrondi en haut de la première carte et en bas
// de la dernière, jointures de 10 px entre les deux. Avec le sélecteur de
// famille, la carte de la liste devient un objet qu'on change à la demande, et
// la colonne une suite de cartes posées : elles se dessinent comme telles.
//
// L'écart grandit avec : deux angles de 2 rem face à face, à 4 px l'un de
// l'autre, creusent un losange de fond que l'œil lit comme un trou. À 12 px,
// c'est un espace.
const CARD_RADIUS = "rounded-4xl";
const CARD_STACK = "flex w-full flex-col gap-3";

// ————— Les onglets : une pill dans une pill —————
//
// La carte des onglets est elle-même une pill, et le segmented control qu'elle
// porte en est une autre : piste et curseur en `rounded-full`, comme partout
// ailleurs. La concentricité est GRATUITE : sur 36 px de haut la piste a un
// rayon de 18 px, la carte qui l'entoure à `--tab-pad` de distance un rayon de
// 18 px + `--tab-pad`, et le curseur, inscrit 3 px plus petit de chaque côté,
// exactement 15 px.
const TAB_GEOMETRY = "[--tab-pad:0.375rem] sm:[--tab-pad:0.5rem]";

// Carte, piste, curseur, onglets : la même pill, à quatre échelles.
const TAB_PILL_RADIUS = "rounded-full";

/** Une carte de la colonne, qui reçoit son arrondi de la colonne. */
type StackCard = (radius: string) => React.ReactNode;

function renderStack(cards: StackCard[]) {
  return cards.map((card) => card(CARD_RADIUS));
}

/**
 * Contenu principal de la page d'un parc.
 *
 * ⚠️ **Ce n'est plus UNE carte, malgré son nom** : c'est une COLONNE de cartes.
 * Le sélecteur d'onglets a la sienne, et chaque bloc de données la sienne —
 * événement, attractions, restaurants, boutiques… et demain les files
 * virtuelles.
 *
 * Le regroupement d'origine (tout dans un seul encadré) empêchait précisément
 * ça : ajouter un bloc, c'était l'empiler à l'intérieur du même contenant, sans
 * frontière visible avec ce qui le précède. La séparation en cartes rend chaque
 * source de données INDÉPENDANTE — elle peut apparaître, disparaître ou changer
 * d'ordre sans toucher aux autres.
 *
 * Les deux onglets se partagent la colonne selon la NATURE de la donnée :
 *   - « En direct » : tout ce qui donne un état à l'instant T (événement,
 *     attractions, restaurants, boutiques, plus tard files virtuelles) ;
 *   - « Horaires du jour » : tout ce qui donne un HORAIRE (représentations, plus
 *     tard ouvertures/fermetures d'attractions, de boutiques, de restaurants).
 *
 * Et dans chaque onglet, une FAMILLE à la fois — attractions, restaurants,
 * boutiques… —, choisie au sélecteur de pastilles (`family-switcher.tsx`) en
 * tête de la carte de la liste : c'est de la navigation aussi. Il s'affiche
 * TOUJOURS, même pour une seule famille, dont la pastille sert alors de titre à
 * la carte (arbitré le 2026-10-06).
 */
export default function MainCard({
  park,
  onRefresh,
  initialRideId = null,
}: MainCardProps) {
  const t = useTranslations("waitTimeTable");
  const tTabs = useTranslations("tabs");
  const tCards = useTranslations("parkPage.cards");
  const tShows = useTranslations("shows");
  const tNoData = useTranslations("noData");
  const reduceMotion = useReducedMotion();
  // Relie les pastilles du sélecteur de famille au panneau qu'elles commandent.
  const familyIdBase = useId();

  // La mise en pause quand l'onglet est caché (et le rattrapage au retour) est
  // gérée par le hook lui-même. ⚠️ L'échéance vient du SERVEUR (`nextUpdateIn`,
  // calculée sur la cadence réelle du worker et sur la fraîcheur de la donnée
  // servie) : ni `park.lastUpdate` seul, qui peut se figer et arrêtait le cycle,
  // ni une minute en dur, qui tombait à côté de l'écriture une fois sur cinq.
  // Voir `useAutoRefresh` et `lib/collection-cycle.ts`.
  const { tick, isRefreshing, handleRefresh } = useAutoRefresh(
    onRefresh,
    park.nextUpdateIn,
  );

  // Direct : le worker vient d'écrire, on va chercher les données sans attendre
  // la fin du décompte. Le flux ne porte que le signal, jamais les données (voir
  // `lib/park-updates.ts`) — le rafraîchissement reste l'appel habituel, donc le
  // journal des consultations et le filtrage IP continuent de s'appliquer.
  // Quand le flux est coupé, il ne se passe rien de particulier : le décompte
  // fait le travail, comme avant son existence.
  const isLive = useParkStream(park.identifier, park.lastUpdate, handleRefresh);

  // Âge de la donnée, qui vieillit chaque seconde. Remplace le décompte : voir
  // le pied de colonne plus bas.
  const dataAge = useDataAge(park.lastUpdate, park.dataAgeSeconds, tick);

  // Fraîcheur de la DONNÉE (horodatage du worker), à distinguer du décompte
  // ci-dessus. Au-delà de ce délai, la source du parc ne répond plus (ou le parc
  // est fermé) : on le dit au lieu d'afficher un décompte qui laisserait croire
  // que les temps affichés sont d'il y a une minute.
  //
  // Évalué APRÈS montage seulement : `Date.now()` ne donne pas la même valeur
  // sous Node et dans le navigateur, et un `lastUpdate` pile sur le seuil
  // produirait une erreur d'hydratation. Le composant se re-rend chaque seconde
  // (décompte), la valeur reste donc à jour ensuite.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const dataIsStale =
    mounted && Date.now() - new Date(park.lastUpdate).getTime() > STALE_DATA_MS;

  // ————— Événements saisonniers —————
  //
  // ⚠️ Évalués APRÈS MONTAGE, pour la même raison que `dataIsStale` : « sommes-
  // nous dans la fenêtre ? » dépend de l'heure courante, qui diffère entre le
  // rendu Node et l'hydratation navigateur. Avant montage, aucune carte
  // d'événement n'est rendue — c'est l'état correct dans la quasi-totalité des
  // cas, et l'ajustement se fait ensuite par un simple re-rendu.
  //
  // Ce composant se re-rend chaque seconde (`tick`) : la carte s'ouvre
  // donc d'elle-même à l'heure d'ouverture, sans rien câbler.
  const eventViews = useMemo(
    () =>
      mounted
        ? visibleParkEvents(
            park.events ?? [],
            new Date(),
            park.openingHours ?? [],
          )
        : // AVANT MONTAGE : on rend quand même les cartes des événements dont la
          // PÉRIODE couvre aujourd'hui, repliées. `inPeriod` est calculé côté
          // serveur à partir de la date locale du parc, pas de l'heure : les deux
          // rendus produisent donc le même HTML, sans risque d'hydratation.
          //
          // Sans ça, la page d'un parc en pleine saison se peignait sans sa carte
          // d'événement, qui apparaissait ensuite d'un coup — et avec elle des
          // attractions absentes de la première image.
          (park.events ?? [])
            .filter(
              (event) =>
                (event.inPeriod && !event.skipsToday) ||
                event.visibility === "forced",
            )
            .map((event) => ({
              event,
              state: "collapsed" as const,
              boundary: null,
              // Même raisonnement : « le parc ouvre-t-il aujourd'hui ? » ne
              // dépend que des lignes du jour, pas de l'heure.
              today:
                event.inPeriod &&
                !event.skipsToday &&
                event.sessions.length === 0 &&
                parkOpensToday(park.openingHours ?? []),
            })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [park.events, park.openingHours, mounted, tick],
  );

  // ⚠️ **Une attraction taguée n'apparaît QUE dans la carte de son événement.**
  // Hors période, sa carte n'est pas rendue et l'attraction disparaît donc de la
  // page — c'est voulu : un maze qui affiche « fermé » en juin entre deux
  // coasters n'apprend rien à personne, et c'est exactement ce que faisait déjà,
  // en dur, le fetcher de Mirabilandia.
  const mainWaitTimes = useMemo(
    () => park.waitTimes.filter((wt) => wt.eventId == null),
    [park.waitTimes],
  );

  // ⚠️ **`wait_times` n'est plus la table des seules attractions** (2026-08-28) :
  // certaines sources y publient l'état de leurs restaurants et boutiques, sous
  // le même espace d'identifiants — chez Bellewaerde, quatorze restaurants sur
  // quinze. Sans cette partition, ils tomberaient au milieu des coasters de la
  // carte « Attractions », triés par temps d'attente avec un « 5 min » qui n'est
  // qu'une sentinelle d'ouverture. Chaque famille a donc SA liste, et les
  // services, qu'aucune ne retient (voir `LIVE_FAMILIES`), ne s'affichent nulle
  // part.
  const liveItems = useMemo(() => {
    const byFamily: Record<LiveFamily, WaitTime[]> = {
      ride: [],
      show: [],
      restaurant: [],
      shop: [],
    };
    for (const wt of mainWaitTimes) {
      if (isLiveFamily(wt.kind)) byFamily[wt.kind].push(wt);
    }
    return byFamily;
  }, [mainWaitTimes]);

  // Même partition pour les spectacles — mais ici la raison n'est pas seulement
  // le rangement : mélanger des représentations NOCTURNES dans la timeline du
  // jour étire l'axe de ~10 h à ~15 h d'amplitude et écrase toutes les
  // représentations de journée. Deux grilles, deux axes.
  const mainShows = useMemo(
    () => (park.shows ?? []).filter((s) => s.eventId == null),
    [park.shows],
  );

  // ————— Heures d'ouverture des POI (`poi_hours`) —————
  //
  // Même partition par famille que le direct, même règle pour les événements :
  // un POI tagué ne vit que dans la carte de son événement.
  const poiHours = park.poiHours ?? [];
  const hoursItems = useMemo(() => {
    const byFamily: Record<HoursFamily, PoiHours[]> = {
      ride: [],
      restaurant: [],
      shop: [],
      hotel: [],
      service: [],
    };
    for (const item of park.poiHours ?? []) {
      if (item.eventId != null) continue;
      if (isScheduleFamily(item.kind) && item.kind !== "show") {
        byFamily[item.kind].push(item);
      }
    }
    return byFamily;
  }, [park.poiHours]);

  // Pour les popups, quelle que soit la liste qui les ouvre : voir
  // `PoiHoursProvider`.
  const hoursContext = useMemo(
    () => ({
      byPoi: new Map<number, PoiHoursSlot[]>(
        (park.poiHours ?? []).map((item) => [item.poiId, item.slots]),
      ),
      timezone: park.timezone,
    }),
    [park.poiHours, park.timezone],
  );

  const parkDate = park.openingHours?.[0]?.date ?? null;

  // Le parc est-il fermé, ou sur le point de l'être ? Sert au formulaire
  // d'alerte : une alerte de RÉOUVERTURE n'a de sens qu'avec assez de journée
  // devant elle. Parc fermé, elle expirerait à minuit (heure du parc) sans avoir
  // pu se déclencher ; à une heure de la fermeture, une attraction qui s'arrête
  // s'arrête pour la nuit, pas pour une panne.
  //
  // MÊME règle que le serveur (`lib/park-closing.ts`), appelée ici avec les
  // horaires déjà chargés — sans quoi l'UI proposerait un bouton que la route de
  // création refuserait ensuite en 409.
  //
  // ⚠️ **`alertOpeningHours` COMPTE les sessions d'événement**, contrairement à
  // `dayOpeningHours` qui borne la journée d'exploitation. Le droit dont il est
  // question ici est celui de CRÉER une alerte, dont le pire échec est une
  // alerte muette : pendant Halloween Horror Nights, on veut pouvoir en poser
  // sur les mazes qui tournent, et sur les attractions de jour au cas où
  // certaines rouvrent pour la soirée.
  //
  // Le piège « la fin de journée est indiscernable d'une panne » reste tenu, mais
  // là où il se joue vraiment : le RÉARMEMENT automatique côté moteur, seul à
  // pouvoir envoyer une notification, garde la vue étroite (voir
  // `lib/park-closing.ts`, `ReopenScope`).
  //
  // Recalculé à chaque rendu — et ce composant se re-rend chaque seconde pour le
  // décompte : le formulaire se referme donc tout seul quand l'heure limite
  // arrive, popup ouvert, sans qu'on ait à câbler quoi que ce soit.
  //
  // `mounted` pour la même raison que `dataIsStale` ci-dessus : l'heure courante
  // diffère entre le rendu Node et l'hydratation. Avant montage on autorise,
  // valeur que le serveur produit dans la quasi-totalité des cas ; l'ajustement
  // éventuel se fait ensuite par un simple re-rendu.
  const reopenAllowed =
    !mounted ||
    (() => {
      const at = new Date();
      return reopenAllowedForWindow(
        parkOpenWindowFrom(alertOpeningHours(park.openingHours ?? []), at),
        at,
        REOPEN_CREATE_CLOSING_MARGIN_MS,
      );
    })();

  // `?tab=shows` : utilisé par les rappels de spectacles, qui doivent ouvrir la
  // page directement sur l'onglet concerné et non sur les temps d'attente.
  const searchParams = useSearchParams();
  const requestedTab = searchParams.get("tab");

  // ————— Les cartes —————
  //
  // ⚠️ ORDRE FIXE : événement, puis temps d'attente. La carte d'événement est
  // TOUJOURS en tête, quelle que soit l'heure — c'est le REPLI qui règle le
  // problème de l'après-midi (mazes fermés), pas un déplacement. Hors fenêtre
  // elle ne pèse qu'une ligne d'en-tête et ne repousse donc rien. Ajouter en
  // plus un réordonnancement à l'horloge, ce serait deux mécanismes pour un seul
  // besoin — et le seul remaniement de la page que l'utilisateur verrait bouger
  // sans avoir rien fait.
  // ⚠️ Une carte d'événement par ONGLET, pas une pour les deux. Un même
  // événement peut n'avoir que des mazes (Mirabilandia), que des spectacles, ou
  // les deux : sa carte n'apparaît donc que dans l'onglet où il a quelque chose
  // à montrer. C'est aussi pour ça que la carte ne se rend pas quand sa liste
  // est vide — sinon un parc sans spectacle d'événement afficherait un encadré
  // vide dans l'onglet Spectacles onze soirs sur dix.
  //
  // ⚠️ **Un événement « Toujours » garde sa carte MÊME VIDE** (2026-08-24), et
  // c'est la seule exception à la règle ci-dessus. `forced` n'est pas un état
  // calculé : c'est une décision prise dans l'admin, dont l'aide dit « la carte
  // s'affiche en permanence, même hors période et même sans dates connues ». La
  // taire faute de contenu rendait le réglage inopérant SANS RIEN DIRE — on
  // cherche alors le bug dans la visibilité, la période, la traduction, partout
  // sauf là où il est.
  //
  // Mesuré sur Universal Studios Florida (24/08) : les huit maisons de Halloween
  // Horror Nights sont bien créées et taguées, mais l'API a cessé de les émettre
  // le 21/08 — leurs lignes `wait_times` restent ouvertes avec un `lastSeenAt`
  // figé, et `getLatestWaitTimesByPark` les écarte au-delà de 3 jours
  // (`STALE_WAIT_TIME_MS`). La carte n'avait donc plus rien à contenir, et
  // disparaissait alors même qu'on venait de demander l'inverse.
  //
  // ⚠️ La carte vide n'apparaît QUE dans l'onglet des temps d'attente, et dans
  // la famille des attractions, jamais ailleurs : ce sont l'onglet et la
  // famille par défaut, et le même encadré vide dupliqué de part et d'autre
  // d'un sélecteur se lirait comme deux événements distincts.
  const hasEventItems = (eventId: number) =>
    park.waitTimes.some((wt) => wt.eventId === eventId) ||
    (park.shows ?? []).some((s) => s.eventId === eventId) ||
    poiHours.some((h) => h.eventId === eventId);

  // ⚠️ **Les cartes d'événement suivent la famille choisie**, comme le reste de
  // la colonne : leurs mazes avec les attractions, un stand éphémère avec les
  // restaurants. Laisser la carte de Halloween et ses mazes au-dessus de la
  // liste des restaurants, ce serait afficher sous la pastille « Restaurants »
  // autre chose que des restaurants.
  const eventItemsFor = (family: LiveFamily) =>
    eventViews
      .map((view) => ({
        view,
        items: park.waitTimes.filter(
          (wt) => wt.eventId === view.event.id && wt.kind === family,
        ),
      }))
      .filter(
        ({ view, items }) =>
          items.length > 0 ||
          (family === "ride" &&
            view.event.visibility === "forced" &&
            !hasEventItems(view.event.id)),
      );

  const eventWaitTimeCardsFor = (family: LiveFamily): StackCard[] =>
    eventItemsFor(family).map(
      ({ view, items }): StackCard =>
        function eventCard(radius: string) {
          return (
            <EventCard
              key={view.event.id}
              view={view}
              timezone={park.timezone}
              className={radius}
              isEmpty={items.length === 0}
            >
              {family === "ride" ? (
                <ParkWaitTimeTable
                  waitTimes={items}
                  queueTypeLabels={park.queueTypeLabels}
                  parkIdentifier={park.identifier}
                  parkName={park.name}
                  reopenAllowed={reopenAllowed}
                  initialRideId={initialRideId}
                />
              ) : (
                <PoiStatusTable
                  pois={items}
                  kind={family}
                  parkIdentifier={park.identifier}
                  parkName={park.name}
                />
              )}
            </EventCard>
          );
        },
    );

  const eventShowCards = eventViews
    .map((view) => ({
      view,
      items: (park.shows ?? []).filter((s) => s.eventId === view.event.id),
    }))
    .filter(({ items }) => items.length > 0)
    .map(
      ({ view, items }): StackCard =>
        function eventCard(radius: string) {
          return (
            <EventCard
              key={view.event.id}
              view={view}
              timezone={park.timezone}
              className={radius}
            >
              <ParkShowTimeTable
                shows={items}
                timezone={park.timezone}
                parkDate={parkDate}
                parkIdentifier={park.identifier}
                parkName={park.name}
              />
            </EventCard>
          );
        },
    );

  // Les heures d'ouverture des POI d'un événement, dans sa carte — un stand
  // éphémère de Noël sous la pastille « Restaurants » des horaires.
  const eventHoursCardsFor = (family: HoursFamily): StackCard[] =>
    eventViews
      .map((view) => ({
        view,
        items: poiHours.filter(
          (h) => h.eventId === view.event.id && h.kind === family,
        ),
      }))
      .filter(({ items }) => items.length > 0)
      .map(
        ({ view, items }): StackCard =>
          function eventCard(radius: string) {
            return (
              <EventCard
                key={view.event.id}
                view={view}
                timezone={park.timezone}
                className={radius}
              >
                <PoiHoursTable
                  items={items}
                  timezone={park.timezone}
                  parkDate={parkDate}
                  parkIdentifier={park.identifier}
                  parkName={park.name}
                  waitTimes={park.waitTimes}
                  reopenAllowed={reopenAllowed}
                />
              </EventCard>
            );
          },
      );

  // La liste d'une famille hors événement dans un onglet, ou `null` si elle
  // n'en a pas.
  //
  // ⚠️ **La même famille n'a pas la même liste d'un onglet à l'autre** : les
  // attractions sont un tableau de temps d'attente en direct, une grille
  // d'heures d'ouverture dans les horaires.
  const familyList = (tab: ColumnTab, family: ParkFamily): React.ReactNode => {
    if (tab === "show-times") {
      if (family === "show") {
        return mainShows.length > 0 ? (
          <ParkShowTimeTable
            shows={mainShows}
            timezone={park.timezone}
            parkDate={parkDate}
            parkIdentifier={park.identifier}
            parkName={park.name}
          />
        ) : null;
      }
      if (!isScheduleFamily(family)) return null;
      const items = hoursItems[family];
      return items.length > 0 ? (
        <PoiHoursTable
          items={items}
          timezone={park.timezone}
          parkDate={parkDate}
          parkIdentifier={park.identifier}
          parkName={park.name}
          waitTimes={park.waitTimes}
          reopenAllowed={reopenAllowed}
        />
      ) : null;
    }

    if (!isLiveFamily(family)) return null;
    if (family === "ride") {
      return liveItems.ride.length > 0 ? (
        <ParkWaitTimeTable
          waitTimes={liveItems.ride}
          queueTypeLabels={park.queueTypeLabels}
          parkIdentifier={park.identifier}
          parkName={park.name}
          reopenAllowed={reopenAllowed}
          initialRideId={initialRideId}
        />
      ) : null;
    }
    return liveItems[family].length > 0 ? (
      <PoiStatusTable
        pois={liveItems[family]}
        kind={family}
        parkIdentifier={park.identifier}
        parkName={park.name}
      />
    ) : null;
  };

  const familyEventCards = (
    tab: ColumnTab,
    family: ParkFamily,
  ): StackCard[] => {
    if (tab === "show-times") {
      if (family === "show") return eventShowCards;
      return isScheduleFamily(family) ? eventHoursCardsFor(family) : [];
    }
    return isLiveFamily(family) ? eventWaitTimeCardsFor(family) : [];
  };

  // Les familles que chaque onglet a de quoi montrer, dans l'ordre des
  // pastilles. Une famille sans rien à montrer n'a pas de pastille.
  const tabFamilies: Record<ColumnTab, ParkFamily[]> = {
    "wait-times": LIVE_FAMILIES.filter(
      (family) =>
        liveItems[family].length > 0 || eventItemsFor(family).length > 0,
    ),
    "show-times": SCHEDULE_FAMILIES.filter(
      (family) =>
        familyList("show-times", family) != null ||
        familyEventCards("show-times", family).length > 0,
    ),
  };

  // ⚠️ **Ce qui décide du sélecteur d'onglets, c'est « l'onglet a-t-il quelque
  // chose à montrer ? »**, pas « y a-t-il des attractions ? ». Une source qui ne
  // publierait QUE des états de restaurants perdrait sinon son sélecteur, et
  // avec lui l'accès aux spectacles. Même règle côté horaires : un parc dont
  // seuls les spectacles d'un événement sont connus a, lui aussi, son onglet.
  const hasLiveContent = tabFamilies["wait-times"].length > 0;
  const hasSchedule = tabFamilies["show-times"].length > 0;
  const showTabs = hasLiveContent && hasSchedule;

  // L'onglet ouvert, décidé AU PREMIER RENDU — donc dès le rendu serveur. Il
  // l'était après hydratation, et la page se peignait jusque-là avec une
  // colonne vide sous les onglets.
  //
  // Onglet initial uniquement : changer d'onglet à la main ne doit pas être
  // écrasé par un rendu ultérieur.
  const [activeTab, setActiveTab] = useState<ColumnTab>(() => {
    // Un lien profond vers une attraction l'emporte sur tout le reste : le
    // popup est dans l'onglet des temps d'attente.
    if (initialRideId != null) return "wait-times";
    if (requestedTab === "shows" || !hasLiveContent) return "show-times";
    return "wait-times";
  });

  // L'onglet dont la colonne est affichée : celui des onglets s'ils existent,
  // sinon le seul qui ait du contenu.
  const columnTab: ColumnTab = showTabs
    ? activeTab
    : hasLiveContent
      ? "wait-times"
      : "show-times";

  // ————— La famille choisie, d'un onglet à l'autre —————
  //
  // Une famille retenue PAR ONGLET, et non une seule pour la page : les deux
  // onglets ne proposent pas les mêmes familles.
  //
  // ⚠️ **Aucune synchro entre onglets** (arbitré le 2026-10-07). Choisir une
  // famille en direct ne la reporte plus dans les horaires : passer d'« En
  // direct » à « Horaires du jour » ouvre TOUJOURS les spectacles — c'est ce
  // qu'on y vient chercher —, voir `changeTab`.
  //
  // `null` : rien de choisi, l'onglet montre sa première famille.
  const [pickedFamily, setPickedFamily] = useState<
    Record<ColumnTab, ParkFamily | null>
  >(() => ({
    // Le popup d'un lien profond est dans la liste des attractions.
    "wait-times": initialRideId != null ? "ride" : null,
    // `?tab=shows` vient d'un rappel de spectacle : c'est la grille des
    // représentations qu'il faut ouvrir, pas la première famille venue.
    "show-times": requestedTab === "shows" ? "show" : null,
  }));
  const [slideDirection, setSlideDirection] = useState(1);

  // ⚠️ Résolue à chaque rendu, jamais figée : si la famille retenue disparaît
  // (source coupée, fin de journée), l'onglet retombe sur sa première famille
  // SANS l'oublier — elle redevient la sélection si elle réapparaît.
  const familyFor = (tab: ColumnTab): ParkFamily | null => {
    const available = tabFamilies[tab];
    const picked = pickedFamily[tab];
    return picked && available.includes(picked)
      ? picked
      : (available[0] ?? null);
  };

  const pickFamily = (tab: ColumnTab, family: ParkFamily) => {
    const available = tabFamilies[tab];
    const current = familyFor(tab);
    if (family === current) return;
    setSlideDirection(
      current == null || available.indexOf(family) > available.indexOf(current)
        ? 1
        : -1,
    );
    setPickedFamily((prev) => ({ ...prev, [tab]: family }));
  };

  const changeTab = (tab: ColumnTab) => {
    // Venir du direct, c'est arriver sur les spectacles, quel que soit le choix
    // laissé la dernière fois dans les horaires. Sans spectacle ce jour-là,
    // `familyFor` retombe sur la première famille.
    if (tab === "show-times" && activeTab === "wait-times") {
      setPickedFamily((prev) => ({ ...prev, "show-times": "show" }));
    }
    setActiveTab(tab);
  };

  const panelIdFor = (tab: ColumnTab) => `${familyIdBase}-panel-${tab}`;

  // Props communes aux deux blocs qui glissent quand on change de famille.
  const slideProps = {
    custom: slideDirection,
    variants: reduceMotion ? FAMILY_FADE : FAMILY_SLIDE,
    initial: "enter",
    animate: "center",
    exit: "exit",
  } as const;

  /**
   * La colonne d'un onglet : les cartes de la famille choisie.
   *
   * Le sélecteur prend la tête de la carte de la liste, à la place de son
   * titre — la pastille active DIT déjà « Restaurants » —, et c'est le CONTENU
   * de cette carte qui glisse d'une famille à l'autre. La carte et ses
   * pastilles, elles, ne bougent pas : c'est ce qui laisse la pastille active
   * s'ouvrir et les autres glisser, au lieu de tout voir disparaître et revenir.
   *
   * ⚠️ **Le sélecteur est là même pour UNE famille** (arbitré le 2026-10-06) :
   * sa pastille unique, à la couleur de la famille, sert de titre à la carte.
   * La carte titrée de la v3 (`SectionCard`) n'est plus rendue ici ; une page
   * ne change donc plus de forme selon que le parc publie ses restaurants ou
   * non.
   *
   * ⚠️ Les cartes d'événement de la famille restent AU-DESSUS, sélecteur
   * compris — la règle « l'événement d'abord » vaut toujours. Elles glissent
   * avec la liste, et disparaissent avec elle quand la famille n'en a pas.
   *
   * ⚠️ `mode="wait"` : l'ancienne liste part AVANT que la nouvelle n'arrive.
   * Les deux ensemble, la carte additionnerait leurs hauteurs le temps de
   * l'animation — cinquante attractions plus douze restaurants — et la page
   * sauterait deux fois.
   */
  const renderColumn = (tab: ColumnTab) => {
    const family = familyFor(tab);
    if (family == null) return null;
    const families = tabFamilies[tab];
    const events = familyEventCards(tab, family);
    const tabIdPrefix = `${familyIdBase}-family-${tab}`;
    return (
      <>
        <AnimatePresence mode="wait" initial={false} custom={slideDirection}>
          {events.length > 0 && (
            <motion.div key={family} {...slideProps} className={CARD_STACK}>
              {renderStack(events)}
            </motion.div>
          )}
        </AnimatePresence>
        {/* Même boîte que `SectionCard` ; le haut de la carte prend le même
            retrait que ses côtés, pour que la pastille de gauche se loge dans
            l'angle à égale distance des deux bords. */}
        <Card
          className={cn("w-full gap-0 p-2.5 py-0 sm:p-4 sm:py-0", CARD_RADIUS)}
        >
          <div className="pt-2.5 pb-1 sm:pt-4">
            <FamilySwitcher
              options={families.map((option) => ({
                family: option,
                label: tCards(CARD_TITLE_KEYS[option]),
                icon: POI_KIND_ICONS[option],
              }))}
              value={family}
              onChange={(picked) => pickFamily(tab, picked)}
              ariaLabel={tTabs("families")}
              idPrefix={tabIdPrefix}
              panelId={panelIdFor(tab)}
            />
          </div>
          {/* `overflow-x-clip` : la liste qui glisse de 28 px ne doit pas
              déborder de la carte le temps de l'animation. `clip` et non
              `hidden` : rien ne devient conteneur de défilement, et les
              éléments collants de la grille des spectacles collent toujours. */}
          <div className="overflow-x-clip pb-2">
            <AnimatePresence
              mode="wait"
              initial={false}
              custom={slideDirection}
            >
              <motion.div
                key={family}
                id={panelIdFor(tab)}
                role="tabpanel"
                aria-labelledby={`${tabIdPrefix}-${family}`}
                {...slideProps}
              >
                <h3 className="sr-only">{tCards(CARD_TITLE_KEYS[family])}</h3>
                {familyList(tab, family)}
              </motion.div>
            </AnimatePresence>
          </div>
        </Card>
      </>
    );
  };

  // Pied de colonne : fraîcheur de la donnée. Posé SOUS les cartes, en texte
  // libre — il décrit l'ensemble, pas un bloc en particulier, et l'enfermer dans
  // l'une des cartes le rattacherait à tort à celle-là.
  //
  // ⚠️ **C'était un décompte jusqu'au 2026-09-03, et c'est devenu faux.** Depuis
  // que le flux SSE devance l'échéance, on lisait « 28 secondes », la page se
  // rafraîchissait aussitôt, et l'affichage repartait à « 90 secondes » : le
  // calcul était juste (le créneau suivant celui qu'on venait de servir) mais il
  // annonçait une attente qui n'arrivait jamais. L'âge de la donnée, lui, se
  // vérifie — et reste vrai que le direct fonctionne ou non.
  const ageLabel =
    dataAge < 60
      ? `${dataAge} ${dataAge < 2 ? t("second") : t("seconds")}`
      : `${Math.floor(dataAge / 60)} ${dataAge < 120 ? t("minute") : t("minutes")}`;

  const footer = (
    <div className="my-4 flex flex-col items-center justify-center text-sm text-muted-foreground">
      {/* Trois états, dans cet ordre : rafraîchissement en cours, données du
          worker périmées, fraîcheur normale.

          ⚠️ « Dernière mise à jour » n'est pas un état d'échec du cycle (il ne
          peut plus se bloquer) mais une information sur la DONNÉE : le worker
          n'a rien écrit depuis 10 min. Le cycle, lui, continue de tourner
          derrière — on réessaie bel et bien. */}
      {isRefreshing ? (
        <div className="flex items-center gap-1 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t("nowRefreshing")}
        </div>
      ) : dataIsStale ? (
        <p>
          {t("lastUpdate")}: {new Date(park.lastUpdate).toLocaleString()}
        </p>
      ) : (
        <p className="flex items-center gap-1.5">
          {/* Plein et pulsant quand le flux est vivant (les temps arrivent
              d'eux-mêmes), creux et immobile quand on est retombé sur le
              rafraîchissement périodique. La pulsation ne porte AUCUNE
              information à elle seule — le `title` dit la même chose en mots,
              parce que ni la couleur ni le mouvement ne doivent être le seul
              véhicule de l'état.

              `motion-reduce:animate-none` : le réglage système du visiteur
              coupe l'animation, le point plein suffit alors à distinguer les
              deux états. */}
          <span
            title={isLive ? t("liveConnected") : t("liveFallback")}
            aria-label={isLive ? t("liveConnected") : t("liveFallback")}
            className={
              isLive
                ? "h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-emerald-500 motion-reduce:animate-none"
                : "h-1.5 w-1.5 shrink-0 rounded-full border border-current opacity-60"
            }
          />
          {t("updatedAgo", { age: ageLabel })}
        </p>
      )}
      {park.shows.length > 0 &&
        columnTab === "show-times" &&
        familyFor("show-times") === "show" && <p>{tShows("updateInfo")}</p>}
    </div>
  );

  // Rien à montrer dans aucun onglet. `waitTimes` peut être NON vide ici : un
  // parc dont la source ne publie que ses services n'a aucune famille à
  // afficher, et lui rendre une colonne vide ne dirait rien.
  if (!hasLiveContent && !hasSchedule) {
    return (
      <div className={CARD_STACK}>
        {/* Seule dans la colonne : elle garde ses quatre gros angles. */}
        <Card className="w-full gap-0 rounded-4xl p-2.5 py-6 sm:p-4 sm:py-6">
          <div className="flex flex-col items-center justify-center gap-y-0.5 text-sm text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <AlertCircle className="size-3.5" />
              <h3 className="text-center font-medium tracking-tight">
                {tNoData("title")}
              </h3>
            </div>
            <p className="text-center">{tNoData("message")}</p>
          </div>
        </Card>
        {footer}
      </div>
    );
  }

  // Un seul type de données : pas de sélecteur d'onglets. Celui des familles
  // peut rester — un parc sans spectacles qui publie ses restaurants —, il vit
  // dans la carte de la liste (voir `renderColumn`).
  if (!showTabs) {
    return (
      <PoiHoursProvider value={hoursContext}>
        <div className={CARD_STACK}>
          {/* `overflow-x-clip` : les cartes d'événement qui glissent de 28 px
              ne doivent pas ouvrir de défilement horizontal sur la page le
              temps de l'animation. */}
          <div className={cn(CARD_STACK, "overflow-x-clip")}>
            {renderColumn(columnTab)}
          </div>
          {footer}
        </div>
      </PoiHoursProvider>
    );
  }

  return (
    <PoiHoursProvider value={hoursContext}>
      <Tabs
        value={activeTab}
        onValueChange={(value) => changeTab(value as ColumnTab)}
        className={CARD_STACK}
      >
        {/* Le sélecteur d'onglets a sa PROPRE carte : c'est de la navigation, pas
          de la donnée. Le mélanger au contenu, c'était faire de l'un des deux
          blocs le « propriétaire » visuel des onglets. Une pill, comme ce
          qu'elle contient — cf. le bloc de géométrie en tête de fichier. */}
        <Card
          className={cn(
            "w-full gap-0 p-(--tab-pad)",
            TAB_GEOMETRY,
            TAB_PILL_RADIUS,
          )}
        >
          <TabsList
            className={cn("relative w-full overflow-hidden", TAB_PILL_RADIUS)}
          >
            {/* Pastille coulissante façon iOS : glisse d'un onglet à l'autre.
              Deux onglets de largeur égale -> largeur 50% (moins le padding),
              translation 0% / 100%. Courbe d'accélération type iOS. */}
            <span
              aria-hidden
              className={cn(
                "pointer-events-none absolute top-[3px] bottom-[3px] left-[3px] w-[calc(50%-3px)] bg-background shadow-sm dark:border dark:border-input dark:bg-input/30",
                TAB_PILL_RADIUS,
              )}
              style={{
                transform:
                  activeTab === "show-times"
                    ? "translateX(100%)"
                    : "translateX(0%)",
                transitionProperty: "transform",
                transitionDuration: "1000ms",
                transitionTimingFunction: "cubic-bezier(0.32, 0.72, 0, 1)",
              }}
            />
            {/* ⚠️ L'onglet actif est TRANSPARENT — c'est le curseur qui est
              dessiné dessous — donc son arrondi ne se voit qu'à l'anneau de
              focus clavier. Il prend quand même la pill : un anneau
              rectangulaire posé sur un curseur arrondi se remarquerait. */}
            <TabsTrigger
              value="wait-times"
              className={cn(
                "relative z-10 data-[state=active]:bg-transparent data-[state=active]:shadow-none dark:data-[state=active]:border-transparent dark:data-[state=active]:bg-transparent",
                TAB_PILL_RADIUS,
              )}
            >
              {/* Ondes de diffusion, pas une horloge : l'onglet ne parle plus de
                temps d'attente mais de tout ce qui est vrai MAINTENANT. */}
              <Radio />
              {tTabs("live")}
            </TabsTrigger>
            <TabsTrigger
              value="show-times"
              className={cn(
                "relative z-10 data-[state=active]:bg-transparent data-[state=active]:shadow-none dark:data-[state=active]:border-transparent dark:data-[state=active]:bg-transparent",
                TAB_PILL_RADIUS,
              )}
            >
              {/* Calendrier + horloge : des heures dans une journée. Les masques
                de théâtre ne valaient que tant que l'onglet ne portait que des
                spectacles. */}
              <CalendarClock />
              {tTabs("schedule")}
            </TabsTrigger>
          </TabsList>
        </Card>

        {/* `overflow-x-clip` : voir la colonne sans onglets, plus haut. */}
        <TabsContent
          value="wait-times"
          className={cn(CARD_STACK, "overflow-x-clip")}
        >
          {renderColumn("wait-times")}
        </TabsContent>
        <TabsContent
          value="show-times"
          className={cn(CARD_STACK, "overflow-x-clip")}
        >
          {renderColumn("show-times")}
        </TabsContent>

        {footer}
      </Tabs>
    </PoiHoursProvider>
  );
}
