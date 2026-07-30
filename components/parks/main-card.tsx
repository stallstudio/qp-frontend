"use client";

import { Card } from "@/components/ui/card";
import { AlertCircle, Clock, Drama, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";
import ParkWaitTimeTable from "./wait-time-table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ParkLiveData } from "@/types/api";
import ParkShowTimeTable from "./show-time-table";

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

export default function MainCard({
  park,
  onRefresh,
  initialRideId = null,
}: MainCardProps) {
  const [activeTab, setActiveTab] = useState<string>("");
  const t = useTranslations("waitTimeTable");
  const tTabs = useTranslations("tabs");
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

  const hasWaitTimes = park.waitTimes && park.waitTimes.length > 0;
  const hasShows = park.shows && park.shows.length > 0;
  const showTabs = hasWaitTimes && hasShows;
  const parkDate = park.openingHours?.[0]?.date ?? null;

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
  return (
    <Card className="w-full rounded-4xl p-2.5 sm:p-4 gap-0 pb-0">
      {showTabs ? (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="relative w-full rounded-3xl overflow-hidden">
            {/* Pastille coulissante façon iOS : glisse d'un onglet à l'autre.
                Deux onglets de largeur égale -> largeur 50% (moins le padding),
                translation 0% / 100%. Courbe d'accélération type iOS. */}
            <span
              aria-hidden
              className="pointer-events-none absolute top-[3px] bottom-[3px] left-[3px] w-[calc(50%-3px)] rounded-3xl bg-background shadow-sm dark:bg-input/30 dark:border dark:border-input"
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
              className="relative z-10 rounded-3xl data-[state=active]:bg-transparent data-[state=active]:shadow-none dark:data-[state=active]:bg-transparent dark:data-[state=active]:border-transparent"
            >
              <Clock />
              {tTabs("waitTimes")}
            </TabsTrigger>
            <TabsTrigger
              value="show-times"
              className="relative z-10 rounded-3xl data-[state=active]:bg-transparent data-[state=active]:shadow-none dark:data-[state=active]:bg-transparent dark:data-[state=active]:border-transparent"
            >
              <Drama />
              {tTabs("shows")}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="wait-times">
            <ParkWaitTimeTable
              waitTimes={park.waitTimes}
              queueTypeLabels={park.queueTypeLabels}
              parkIdentifier={park.identifier}
              parkName={park.name}
              initialRideId={initialRideId}
            />
          </TabsContent>
          <TabsContent value="show-times">
            <ParkShowTimeTable
              shows={park.shows}
              timezone={park.timezone}
              parkDate={parkDate}
              parkIdentifier={park.identifier}
              parkName={park.name}
            />
          </TabsContent>
        </Tabs>
      ) : hasWaitTimes ? (
        <ParkWaitTimeTable
          waitTimes={park.waitTimes}
          queueTypeLabels={park.queueTypeLabels}
          parkIdentifier={park.identifier}
          parkName={park.name}
          initialRideId={initialRideId}
        />
      ) : hasShows ? (
        <ParkShowTimeTable
          shows={park.shows}
          timezone={park.timezone}
          parkDate={parkDate}
          parkIdentifier={park.identifier}
          parkName={park.name}
        />
      ) : null}
      {park.shows.length === 0 && park.waitTimes.length === 0 && (
        <div className="flex items-center justify-center flex-col gap-y-0.5 text-sm text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <AlertCircle className="size-3.5" />
            <h3 className="font-medium tracking-tight text-center">
              {tNoData("title")}
            </h3>
          </div>
          <p className="text-center">{tNoData("message")}</p>
        </div>
      )}
      <div className="flex justify-center text-sm text-muted-foreground my-4 flex-col items-center">
        {/* Trois états, dans cet ordre : rafraîchissement en cours, données du
            worker périmées, décompte normal.

            ⚠️ « Dernière mise à jour » n'est plus l'état d'échec du décompte
            (celui-ci ne peut plus se bloquer) mais une information sur la
            DONNÉE : le worker n'a rien écrit depuis 10 min. Le décompte, lui,
            continue de tourner derrière — on réessaie bel et bien. */}
        {isRefreshing ? (
          <div className="flex text-muted-foreground items-center gap-1">
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
    </Card>
  );
}
