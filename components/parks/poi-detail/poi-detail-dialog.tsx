"use client";

import { useTranslations } from "next-intl";
import { BookOpenText, ExternalLink, Smartphone } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DETAIL_DIALOG_CLASS } from "@/lib/detail-dialog";
import ImageSection from "@/components/parks/attraction-detail/image-section";
import LiveStats, {
  liveStatCount,
} from "@/components/parks/attraction-detail/live-stats";
import PoiFacts, {
  factsFitInStrip,
  poiFactStats,
  usePoiFacts,
} from "@/components/parks/attraction-detail/poi-facts";
import AlertSection from "@/components/parks/attraction-detail/alert-section";
import { getPrimaryQueue } from "@/lib/poi-list";
import { showsWaitTime } from "@/lib/poi-kinds";
import { poiFavorite } from "@/lib/favorites-storage";
import type { WaitTime } from "@/types/waitTime";
import {
  PoiHoursList,
  usePoiHoursOf,
} from "@/components/parks/poi-hours-context";
import { useCommunicatesTimes } from "@/components/parks/timed-kinds-context";

type PoiDetailDialogProps = {
  target: WaitTime | null;
  // Décide si le bandeau montre un temps d'attente (voir `showsWaitTime`).
  parkIdentifier: string;
  parkName: string;
  // Voir `AlertSection`. Non fourni = on autorise.
  reopenAllowed?: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * Le lien de la carte mène-t-il à une page de COMMANDE en ligne ? Reconnue à
 * son adresse (relevé en base le 2026-10-07). Une page web n'en est pas une par
 * défaut : Tokyo Disney et Paultons (tenkites) publient une carte à lire, rien
 * de plus.
 *   - pej.se : la commande des parcs PRS (Gröna Lund, Furuvik, Skara…) ;
 *   - /streamlinedmenu/ : l'app de commande des parcs Miral (Agilysys) ;
 *   - kolmarden.com/mat-online : la page qui regroupe les liens pej.se.
 */
function isOrderPage(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "");
    return (
      host === "pej.se" ||
      parsed.pathname.startsWith("/streamlinedmenu/") ||
      (host === "kolmarden.com" && parsed.pathname.startsWith("/mat-online"))
    );
  } catch {
    return false;
  }
}

/**
 * Popup d'un POI qui n'est ni une attraction ni un spectacle : restaurant,
 * boutique, hôtel, service.
 *
 * ⚠️ **Même EN-TÊTE que le popup d'attraction, corps entièrement différent.**
 * `ImageSection` est réutilisé tel quel — bannière du parc, nom, étoile,
 * crédit — parce que c'est l'identité visuelle de la fiche, pas un détail
 * d'attraction. En dessous, pas de graphique : l'historique d'un témoin
 * ouvert/fermé est une ligne plate. `useRideHistory` n'est donc pas appelé —
 * c'est une requête réseau par ouverture en moins.
 *
 * ⚠️ **Une alerte, mais seulement là où le parc publie l'attente** (2026-10-09)
 * — les restaurants des parcs PRS, de Nagashima Spa Land : `showsWaitTime`, et
 * `useCommunicatesTimes` pour le parc. Sur un simple témoin ouvert/fermé, ni
 * seuil à franchir, ni réouverture qui vaille une notification.
 *
 * ⚠️ **Même forme que le popup d'attraction depuis le 2026-10-07** : le
 * bandeau de chiffres à cheval sur la bannière (`LiveStats`, sans la colonne
 * « Attente » pour un simple témoin ouvert/fermé), puis la carte en une ligne.
 *
 * ⚠️ **Le corps se limite à l'état, et le menu quand il existe** (arbitré le
 * 2026-08-28). Un bloc « Informations » reprenant la zone, la catégorie et les
 * étiquettes de la source a été écrit puis RETIRÉ : ces valeurs arrivent dans la
 * langue du flux du parc — « Zoetigheden » chez Bellewaerde, qui publie en
 * néerlandais —, et trois pastilles intraduisibles sous une pastille d'état ne
 * valent pas la place qu'elles prennent. Elles ne sont donc plus transportées
 * non plus : `WaitTime` ne porte que `menu`.
 *
 * ⚠️ **Le menu est rare.** Vérifié le 2026-08-28 : aucun des quatre parcs
 * Compagnie des Alpes n'en publie, alors que le champ existe dans leur CMS.
 * D'autres sources en publient (Disney Japon, Miral, Parc Astérix, Paultons,
 * Tibidabo, Dreamworld) — d'où un popup qui, chez Bellewaerde, se réduit
 * aujourd'hui à sa bannière et à son état. C'est le rendu attendu.
 */
export default function PoiDetailDialog({
  target,
  parkIdentifier,
  parkName,
  reopenAllowed = true,
  onOpenChange,
}: PoiDetailDialogProps) {
  const t = useTranslations("poiDetail");
  const tAttraction = useTranslations("attractionDetail");
  // Les heures du jour, quand la page de parc les a (voir `PoiHoursProvider`).
  const hours = usePoiHoursOf(target?.rideId);
  // Sur une page de commande, le bouton dit qu'on peut aussi commander.
  const isOrder = isOrderPage(target?.menu);
  const menuAction = isOrder ? t("orderAction") : t("menuAction");
  const MenuIcon = isOrder ? Smartphone : BookOpenText;

  const queue = target ? getPrimaryQueue(target) : undefined;
  const showWait = target ? showsWaitTime(parkIdentifier, target.kind) : false;
  const timed = useCommunicatesTimes(target?.kind);
  // Une alerte n'a de sens que sur une attente publiée — voir plus haut.
  const alertable = showWait && timed && queue !== undefined;
  const currentWaitTime =
    queue && queue.status === "open" && queue.waitTime >= 0
      ? queue.waitTime
      : undefined;
  const favorite = target
    ? poiFavorite(parkIdentifier, {
        id: target.rideId,
        name: target.rideName,
        kind: target.kind,
      })
    : null;
  // Peur et prix : une maison hantée que la source range ailleurs qu'en
  // attraction ou en spectacle. Dans le bandeau s'ils y tiennent, dans le corps
  // sinon (voir `factsFitInStrip`).
  const facts = usePoiFacts(target?.fearLevel ?? null, target?.price ?? null);
  const stripCells = liveStatCount({ queue, hours, showWait });
  const factsInStrip = factsFitInStrip(facts, stripCells);
  const hasStrip = stripCells > 0 || factsInStrip;
  // Un service coupé (déjeuner, dîner) : le bandeau ne dit que l'heure qui
  // compte à l'instant, la liste dit la journée.
  const splitDay = hours && hours.slots.length > 1;
  const hasFacts =
    !factsInStrip && (facts.fearLevel !== null || facts.price !== null);

  return (
    <Dialog open={target !== null} onOpenChange={onOpenChange}>
      {/* Même coquille que le popup d'attraction : en-tête épinglée (bannière
          + bandeau), corps défilant. */}
      <DialogContent
        className={DETAIL_DIALOG_CLASS}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {target && (
          <>
            {/* Titre/description accessibles (le nom visible est sur la photo). */}
            <DialogHeader className="sr-only">
              <DialogTitle>{target.rideName}</DialogTitle>
              <DialogDescription>
                {t("openFor", { poi: target.rideName })}
              </DialogDescription>
            </DialogHeader>

            <div className={hasStrip ? "shrink-0" : "shrink-0 pb-1"}>
              <ImageSection
                title={target.rideName}
                favNamespace={favorite?.namespace}
                favKey={favorite?.key}
                // Le quartier du parc sous le nom, comme pour une attraction
                // (« Frontierland »). Sans zone publiée, la ligne disparaît —
                // voir `readPoiZone`.
                place={target.zone}
                banner={target.banner}
                credit={parkName}
                overlapped={hasStrip}
              />
              {hasStrip && (
                <div className="relative z-10 -mt-10 px-4">
                  <LiveStats
                    queue={queue}
                    hours={hours}
                    // Un témoin ouvert/fermé n'a pas de plafond de source.
                    waitCap={null}
                    showWait={showWait}
                  >
                    {factsInStrip && poiFactStats(facts)}
                  </LiveStats>
                </div>
              )}
            </div>

            {/* Rien à mettre dessous (ni alerte, ni journée coupée, ni carte,
                ni peur et prix restés hors du bandeau) : pas de corps du tout,
                plutôt qu'une marge vide sous le bandeau. */}
            {(alertable || splitDay || target.menu || hasFacts) && (
            <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-5 pt-5 pb-5 scrollbar-hide *:shrink-0">
              {hasFacts && <PoiFacts facts={facts} />}

              {/* La seule action du popup, en tête comme sur une attraction. */}
              {alertable && queue && (
                <AlertSection
                  rideId={target.rideId}
                  rideName={target.rideName}
                  parkIdentifier={parkIdentifier}
                  parkName={parkName}
                  queueType={queue.type}
                  currentSlot={queue.timeSlot}
                  timezone={hours?.timezone ?? null}
                  currentWaitTime={currentWaitTime}
                  currentStatus={queue.status}
                  reopenAllowed={reopenAllowed}
                  poi
                />
              )}

              {splitDay && (
                <div className="flex flex-col gap-2">
                  <h3 className="text-[15px] font-semibold">
                    {tAttraction("chartToday")}
                  </h3>
                  <PoiHoursList slots={hours.slots} timezone={hours.timezone} />
                </div>
              )}

              {/* ⚠️ Une LIGNE de lien, pas une section : un titre « Carte »
                  au-dessus d'un bouton « Voir la carte » disait deux fois la
                  même chose. Même forme que la ligne d'alerte d'une
                  attraction. */}
              {/* ⚠️ Plusieurs cartes (Tivoli Gardens : déjeuner, dîner,
                  enfants…) : le même cadre, mais une PASTILLE par carte sous
                  le titre, qui passent à la ligne. Cinq boutons pleine
                  largeur doubleraient la hauteur du popup pour cinq liens.
                  Le libellé est celui de la source, non traduit — la seule
                  chose qui distingue deux cartes ; sans libellé, le nôtre.
                  `menus[0]` EST `menu` : la liste remplace la ligne. */}
              {target.menus ? (
                <div className="flex items-start gap-3 rounded-2xl border bg-muted/40 px-3 py-2.5">
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-restaurant/15 text-restaurant">
                    <BookOpenText className="size-4" />
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col gap-2 pt-1.5">
                    <span className="text-sm font-semibold">
                      {t("menusTitle")}
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {target.menus.map((link) => {
                        const LinkIcon = isOrderPage(link.url)
                          ? Smartphone
                          : ExternalLink;
                        return (
                          <a
                            key={link.url}
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex max-w-full items-center gap-1 rounded-full border bg-background px-2.5 py-1 text-xs font-medium transition-colors hover:bg-muted"
                          >
                            <span className="truncate">
                              {link.label ?? t("menuTitle")}
                            </span>
                            <LinkIcon className="size-3 shrink-0 text-muted-foreground" />
                          </a>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : target.menu && (
                // Nouvel onglet, et `noopener` comme tout lien sortant.
                <a
                  href={target.menu}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${t("menuTitle")} — ${menuAction}`}
                  className="group flex items-center gap-3 rounded-2xl border bg-muted/40 px-3 py-2.5 transition-colors hover:bg-muted"
                >
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-restaurant/15 text-restaurant">
                    <MenuIcon className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1 text-sm font-semibold">
                    {menuAction}
                  </span>
                  <ExternalLink className="size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" />
                </a>
              )}
            </div>
            )}
            {!(alertable || splitDay || target.menu || hasFacts) && hasStrip && <div className="h-4" />}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
