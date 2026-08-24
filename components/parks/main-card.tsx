"use client";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  AlertCircle,
  CalendarClock,
  Drama,
  Loader2,
  Radio,
  RollerCoaster,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";
import ParkWaitTimeTable from "./wait-time-table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ParkLiveData } from "@/types/api";
import {
  parkOpenWindowFrom,
  reopenAllowedForWindow,
  REOPEN_CREATE_CLOSING_MARGIN_MS,
} from "@/lib/park-closing";
import { dayOpeningHours, visibleParkEvents } from "@/lib/park-events";
import ParkShowTimeTable from "./show-time-table";
import EventCard from "./event-card";
import SectionCard from "./section-card";

type MainCardProps = {
  park: ParkLiveData;
  onRefresh?: () => Promise<void>;
  // Lien profond vers une attraction : force l'onglet « temps d'attente » et
  // demande à la table d'ouvrir le popup correspondant.
  initialRideId?: number | null;
};

// Au-delà de ce délai sans écriture du worker, on affiche l'horodatage des
// données plutôt que le décompte (voir `dataIsStale`).
const STALE_DATA_MS = 10 * 60_000;

// Espacement entre les cartes de la colonne. Aligné sur le `gap-1` de la page
// (`park-page-client.tsx`), qui sépare déjà l'en-tête du parc du contenu.
const CARD_STACK = "flex w-full flex-col gap-1";

// ————— Arrondis de la pile —————
//
// La colonne se lit comme UN bloc découpé en tranches, pas comme une poignée de
// cartes posées côte à côte : gros arrondi sur le DESSUS de la première et le
// DESSOUS de la dernière, arrondi discret partout où deux cartes se touchent.
//
// Deux angles de 2 rem face à face, séparés par le `gap-1`, creusaient un
// losange de fond entre chaque carte — l'œil y voyait un trou, pas une
// jointure. À l'inverse, tout aplatir aurait rendu la colonne monolithique et
// annulé la séparation qu'on vient d'introduire.
const STACK_JOINT = "rounded-lg";
const STACK_TOP = "rounded-t-4xl";
const STACK_BOTTOM = "rounded-b-4xl";

/**
 * Classes d'arrondi d'une carte selon sa place dans la colonne.
 *
 * ⚠️ Seules les cartes de DONNÉES entrent dans ce calcul. Le sélecteur
 * d'onglets n'en fait pas partie : c'est une pastille posée au-dessus de la
 * pile, pas une tranche du bloc (voir le commentaire au point de rendu).
 */
function stackRadius(isFirst: boolean, isLast: boolean) {
  return cn(STACK_JOINT, isFirst && STACK_TOP, isLast && STACK_BOTTOM);
}

/** Une carte de la colonne, en attente de savoir où elle atterrit. */
type StackCard = (radius: string) => React.ReactNode;

/** Rend une pile de cartes en donnant à chacune ses arrondis. */
function renderStack(cards: StackCard[]) {
  return cards.map((card, i) =>
    card(stackRadius(i === 0, i === cards.length - 1)),
  );
}

/**
 * Contenu principal de la page d'un parc.
 *
 * ⚠️ **Ce n'est plus UNE carte, malgré son nom** : c'est une COLONNE de cartes.
 * Le sélecteur d'onglets a la sienne, et chaque bloc de données la sienne —
 * événement, temps d'attente, et demain restaurants ou files virtuelles.
 *
 * Le regroupement d'origine (tout dans un seul encadré) empêchait précisément
 * ça : ajouter un bloc, c'était l'empiler à l'intérieur du même contenant, sans
 * frontière visible avec ce qui le précède. La séparation en cartes rend chaque
 * source de données INDÉPENDANTE — elle peut apparaître, disparaître ou changer
 * d'ordre sans toucher aux autres.
 *
 * Les deux onglets se partagent la colonne selon la NATURE de la donnée :
 *   - « Temps d'attente » : tout ce qui donne un état à l'instant T (événement,
 *     attractions, plus tard restaurants et files virtuelles) ;
 *   - « Spectacles » : tout ce qui donne un HORAIRE (représentations, plus tard
 *     ouvertures/fermetures d'attractions, de boutiques, de restaurants).
 */
export default function MainCard({
  park,
  onRefresh,
  initialRideId = null,
}: MainCardProps) {
  const [activeTab, setActiveTab] = useState<string>("");
  const t = useTranslations("waitTimeTable");
  const tTabs = useTranslations("tabs");
  const tCards = useTranslations("parkPage.cards");
  const tShows = useTranslations("shows");
  const tNoData = useTranslations("noData");

  // La mise en pause quand l'onglet est caché (et le rattrapage au retour) est
  // gérée par le hook lui-même. ⚠️ Le décompte est celui du prochain FETCH
  // CLIENT ; il ne dépend plus de `park.lastUpdate`, qui pouvait se figer et
  // arrêter le cycle pour de bon (voir `useAutoRefresh`).
  const { timeSinceLastUpdate, isRefreshing } = useAutoRefresh(onRefresh, 60000);

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
  // Ce composant se re-rend chaque seconde pour le décompte : la carte s'ouvre
  // donc d'elle-même à l'heure d'ouverture, sans rien câbler.
  const eventViews = useMemo(
    () =>
      mounted
        ? visibleParkEvents(park.events ?? [], new Date())
        : // AVANT MONTAGE : on rend quand même les cartes des événements dont la
          // PÉRIODE couvre aujourd'hui, repliées. `inPeriod` est calculé côté
          // serveur à partir de la date locale du parc, pas de l'heure : les deux
          // rendus produisent donc le même HTML, sans risque d'hydratation.
          //
          // Sans ça, la page d'un parc en pleine saison se peignait sans sa carte
          // d'événement, qui apparaissait ensuite d'un coup — et avec elle des
          // attractions absentes de la première image.
          (park.events ?? [])
            .filter((event) => event.inPeriod || event.visibility === "forced")
            .map((event) => ({
              event,
              state: "collapsed" as const,
              boundary: null,
            })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [park.events, mounted, timeSinceLastUpdate],
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

  // Même partition pour les spectacles — mais ici la raison n'est pas seulement
  // le rangement : mélanger des représentations NOCTURNES dans la timeline du
  // jour étire l'axe de ~10 h à ~15 h d'amplitude et écrase toutes les
  // représentations de journée. Deux grilles, deux axes.
  const mainShows = useMemo(
    () => (park.shows ?? []).filter((s) => s.eventId == null),
    [park.shows],
  );

  const hasWaitTimes = mainWaitTimes.length > 0;
  const hasShows = mainShows.length > 0;
  const showTabs = hasWaitTimes && hasShows;
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
  // ⚠️ **`dayOpeningHours` exclut les sessions d'ÉVÉNEMENT.** Une nocturne qui
  // court jusqu'à 1 h du matin rouvrirait sinon ce droit sur TOUTES les
  // attractions, y compris celles de jour arrêtées pour la nuit — soit
  // exactement le piège « la fin de journée est indiscernable d'une panne ».
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
        parkOpenWindowFrom(dayOpeningHours(park.openingHours ?? []), at),
        at,
        REOPEN_CREATE_CLOSING_MARGIN_MS,
      );
    })();

  // `?tab=shows` : utilisé par les rappels de spectacles, qui doivent ouvrir la
  // page directement sur l'onglet concerné et non sur les temps d'attente.
  const searchParams = useSearchParams();
  const requestedTab = searchParams.get("tab");

  useEffect(() => {
    if (showTabs) {
      // Un lien profond vers une attraction l'emporte sur tout le reste : le
      // popup est dans l'onglet des temps d'attente.
      if (initialRideId != null) {
        setActiveTab("wait-times");
      } else if (requestedTab === "shows" || (hasShows && !hasWaitTimes)) {
        setActiveTab("show-times");
      } else {
        setActiveTab("wait-times");
      }
    }
    // Onglet initial uniquement : changer d'onglet à la main ne doit pas être
    // écrasé par un rendu ultérieur.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
  // ⚠️ La carte vide n'apparaît QUE dans l'onglet des temps d'attente, jamais
  // dans les deux : c'est l'onglet par défaut, et le même encadré vide dupliqué
  // de part et d'autre du sélecteur se lirait comme deux événements distincts.
  const hasEventItems = (eventId: number) =>
    park.waitTimes.some((wt) => wt.eventId === eventId) ||
    (park.shows ?? []).some((s) => s.eventId === eventId);

  const eventWaitTimeCards = eventViews
    .map((view) => ({
      view,
      items: park.waitTimes.filter((wt) => wt.eventId === view.event.id),
    }))
    .filter(
      ({ view, items }) =>
        items.length > 0 ||
        (view.event.visibility === "forced" && !hasEventItems(view.event.id)),
    )
    .map(({ view, items }): StackCard => (radius) => (
      <EventCard
        key={view.event.id}
        view={view}
        timezone={park.timezone}
        className={radius}
        isEmpty={items.length === 0}
      >
        <ParkWaitTimeTable
          waitTimes={items}
          queueTypeLabels={park.queueTypeLabels}
          parkIdentifier={park.identifier}
          parkName={park.name}
          reopenAllowed={reopenAllowed}
          initialRideId={initialRideId}
        />
      </EventCard>
    ));

  const eventShowCards = eventViews
    .map((view) => ({
      view,
      items: (park.shows ?? []).filter((s) => s.eventId === view.event.id),
    }))
    .filter(({ items }) => items.length > 0)
    .map(({ view, items }): StackCard => (radius) => (
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
    ));

  const waitTimesCard: StackCard = (radius) => (
    <SectionCard
      key="wait-times"
      icon={RollerCoaster}
      title={tCards("attractions")}
      className={radius}
    >
      <ParkWaitTimeTable
        waitTimes={mainWaitTimes}
        queueTypeLabels={park.queueTypeLabels}
        parkIdentifier={park.identifier}
        parkName={park.name}
        reopenAllowed={reopenAllowed}
        initialRideId={initialRideId}
      />
    </SectionCard>
  );

  const showsCard: StackCard = (radius) => (
    <SectionCard
      key="show-times"
      icon={Drama}
      title={tCards("shows")}
      className={radius}
    >
      <ParkShowTimeTable
        shows={mainShows}
        timezone={park.timezone}
        parkDate={parkDate}
        parkIdentifier={park.identifier}
        parkName={park.name}
      />
    </SectionCard>
  );

  // Les deux piles, dans leur ordre d'affichage. C'est cette liste — et elle
  // seule — qui dit quelle carte est en haut et laquelle est en bas ; ajouter
  // demain les restaurants ou les files virtuelles, c'est l'insérer ici, les
  // arrondis suivent.
  const waitTimesStack: StackCard[] = [
    ...eventWaitTimeCards,
    ...(hasWaitTimes ? [waitTimesCard] : []),
  ];
  const showsStack: StackCard[] = [
    ...eventShowCards,
    ...(hasShows ? [showsCard] : []),
  ];

  // Pied de colonne : décompte de rafraîchissement. Posé SOUS les cartes, en
  // texte libre — il décrit la fraîcheur de l'ensemble, pas d'un bloc en
  // particulier, et l'enfermer dans l'une des cartes le rattacherait à tort à
  // celle-là.
  const footer = (
    <div className="my-4 flex flex-col items-center justify-center text-sm text-muted-foreground">
      {/* Trois états, dans cet ordre : rafraîchissement en cours, données du
          worker périmées, décompte normal.

          ⚠️ « Dernière mise à jour » n'est plus l'état d'échec du décompte
          (celui-ci ne peut plus se bloquer) mais une information sur la
          DONNÉE : le worker n'a rien écrit depuis 10 min. Le décompte, lui,
          continue de tourner derrière — on réessaie bel et bien. */}
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
        <p>
          {t("refreshingIn")} {timeSinceLastUpdate}{" "}
          {timeSinceLastUpdate < 2 ? t("second") : t("seconds")}
        </p>
      )}
      {park.shows.length > 0 && activeTab === "show-times" && (
        <p>{tShows("updateInfo")}</p>
      )}
    </div>
  );

  if (park.shows.length === 0 && park.waitTimes.length === 0) {
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

  // Un seul type de données : pas de sélecteur d'onglets, juste les cartes.
  if (!showTabs) {
    return (
      <div className={CARD_STACK}>
        {renderStack([...waitTimesStack, ...showsStack])}
        {footer}
      </div>
    );
  }

  return (
    <Tabs
      value={activeTab}
      onValueChange={setActiveTab}
      className={CARD_STACK}
    >
      {/* ————— Le sélecteur d'onglets n'a PAS de carte autour de lui —————
          (2026-08-24)

          Il en avait une, qui portait alors le haut de la colonne. Elle est
          retirée parce qu'elle empilait deux formes contradictoires : une carte
          de 48 px arrondie à 32 px EN HAUT et 8 px en bas — donc une arche —
          enfermant une pastille, elle, parfaitement ronde. Rendre l'arche
          concentrique demandait d'aplatir la pastille (« un galet coupé au
          couteau »), et l'arrondir partout revenait à dessiner deux galets
          imbriqués.

          ⚠️ **La pastille se suffit à elle-même** : c'est de la navigation, pas
          de la donnée, et elle n'a jamais eu besoin d'un fond pour se poser.
          Conséquence à ne pas oublier — la première carte de CONTENU redevient
          le haut de la pile et reprend son gros arrondi (`renderStack` sans
          `headed`). */}
      <TabsList className="relative mb-1 w-full overflow-hidden rounded-3xl">
        {/* Pastille coulissante façon iOS : glisse d'un onglet à l'autre.
            Deux onglets de largeur égale -> largeur 50% (moins le padding),
            translation 0% / 100%. Courbe d'accélération type iOS. */}
        <span
          aria-hidden
          className="pointer-events-none absolute top-[3px] bottom-[3px] left-[3px] w-[calc(50%-3px)] rounded-3xl bg-background shadow-sm dark:border dark:border-input dark:bg-input/30"
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
        <TabsTrigger
          value="wait-times"
          className="relative z-10 rounded-3xl data-[state=active]:bg-transparent data-[state=active]:shadow-none dark:data-[state=active]:border-transparent dark:data-[state=active]:bg-transparent"
        >
          {/* Ondes de diffusion, pas une horloge : l'onglet ne parle plus de
              temps d'attente mais de tout ce qui est vrai MAINTENANT. */}
          <Radio />
          {tTabs("live")}
        </TabsTrigger>
        <TabsTrigger
          value="show-times"
          className="relative z-10 rounded-3xl data-[state=active]:bg-transparent data-[state=active]:shadow-none dark:data-[state=active]:border-transparent dark:data-[state=active]:bg-transparent"
        >
          {/* Calendrier + horloge : des heures dans une journée. Les masques
              de théâtre ne valaient que tant que l'onglet ne portait que des
              spectacles. */}
          <CalendarClock />
          {tTabs("schedule")}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="wait-times" className={CARD_STACK}>
        {renderStack(waitTimesStack)}
      </TabsContent>
      <TabsContent value="show-times" className={CARD_STACK}>
        {renderStack(showsStack)}
      </TabsContent>

      {footer}
    </Tabs>
  );
}
