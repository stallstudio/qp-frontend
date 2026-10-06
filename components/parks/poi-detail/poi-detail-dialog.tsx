"use client";

import { useTranslations } from "next-intl";
import { BookOpenText, Clock, ExternalLink, Radio } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import ImageSection from "@/components/parks/attraction-detail/image-section";
import { getStatusBadge } from "@/lib/badge";
import { getPrimaryQueue } from "@/lib/poi-list";
import type { WaitTime } from "@/types/waitTime";
import {
  PoiHoursList,
  usePoiHoursOf,
} from "@/components/parks/poi-hours-context";

type PoiDetailDialogProps = {
  target: WaitTime | null;
  parkName: string;
  onOpenChange: (open: boolean) => void;
};

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t px-5 py-3">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
        {icon}
        {title}
      </h3>
      {children}
    </section>
  );
}

type MenuFormat = "pdf" | "image" | "page";

/**
 * Ce qu'ouvre le lien de la carte, d'après l'extension de son adresse : un
 * PDF, une image, ou à défaut une page web. Seul le FORMAT est dit, pas le
 * site — c'est toujours celui du parc, le nommer n'apprend rien. `null` sur
 * une URL illisible : le lien reste, sans sous-titre.
 */
function menuFormat(url: string | null | undefined): MenuFormat | null {
  if (!url) return null;
  try {
    const path = new URL(url).pathname;
    if (/\.pdf$/i.test(path)) return "pdf";
    if (/\.(jpe?g|png|webp|gif|avif)$/i.test(path)) return "image";
    return "page";
  } catch {
    return null;
  }
}

/**
 * Popup d'un POI qui n'est ni une attraction ni un spectacle : restaurant,
 * boutique, hôtel, service.
 *
 * ⚠️ **Même EN-TÊTE que le popup d'attraction, corps entièrement différent.**
 * `ImageSection` est réutilisé tel quel — bannière du parc, nom, lien Thrills,
 * crédit — parce que c'est l'identité visuelle de la fiche, pas un détail
 * d'attraction. En dessous, ni graphique ni alerte : l'historique d'un témoin
 * ouvert/fermé est une ligne plate, et une alerte de seuil n'a pas de seuil à
 * franchir. `useRideHistory` n'est donc pas appelé — c'est une requête réseau
 * par ouverture en moins.
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
  parkName,
  onOpenChange,
}: PoiDetailDialogProps) {
  const t = useTranslations("poiDetail");
  const tStatus = useTranslations("attractionStatus");
  const tTabs = useTranslations("tabs");
  // Les heures du jour, quand la page de parc les a (voir `PoiHoursProvider`).
  const hours = usePoiHoursOf(target?.rideId);
  const format = menuFormat(target?.menu);
  // « PDF » se lit tel quel dans toutes les langues.
  const menuSource =
    format === "pdf"
      ? "PDF"
      : format === "image"
        ? t("menuImage")
        : format === "page"
          ? t("menuPage")
          : null;

  const queue = target ? getPrimaryQueue(target) : undefined;
  const statusLabels: Record<string, string> = {
    open: tStatus("open"),
    closed: tStatus("closed"),
    down: tStatus("down"),
    maintenance: tStatus("maintenance"),
  };

  return (
    <Dialog open={target !== null} onOpenChange={onOpenChange}>
      {/* Même coquille que le popup d'attraction : en-tête épinglée, corps
          défilant. Le corps est court ici, mais une fiche à rallonge (dix
          étiquettes) ne doit pas pousser l'image hors champ. */}
      <DialogContent
        className="flex max-h-[88vh] flex-col gap-0 overflow-hidden rounded-4xl border-0 p-0 sm:max-w-md"
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

            <div className="shrink-0">
              {/* Ni `favNamespace` ni `favKey` : pas d'étoile sur ces POI, voir
                  `ImageSection`. */}
              <ImageSection
                title={target.rideName}
                // ⚠️ Libellé PROPRE à ce popup : celui du popup d'attraction
                // dit « Voir l'attraction sur Thrills », ce qui est faux sur un
                // restaurant. Même lien, formulation neutre.
                link={{
                  url: "https://thrills.world",
                  label: t("thrillsLink"),
                }}
                banner={target.banner}
                credit={parkName}
              />
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto scrollbar-hide">
              {queue && (
                <Section
                  title={t("statusTitle")}
                  icon={<Radio className="size-4" />}
                >
                  {getStatusBadge(queue.status, statusLabels)}
                </Section>
              )}

              {hours && (
                <Section
                  title={tTabs("schedule")}
                  icon={<Clock className="size-4" />}
                >
                  <PoiHoursList slots={hours.slots} timezone={hours.timezone} />
                </Section>
              )}

              {/* ⚠️ Une LIGNE de lien, pas une section : un titre « Carte »
                  au-dessus d'un bouton « Voir la carte » disait deux fois la
                  même chose, et le gros bouton orange prenait le pas sur l'état
                  et les horaires, qui sont l'information. Le sous-titre dit ce
                  qu'ouvre le lien : un PDF, une image ou une page web. */}
              {target.menu && (
                <div className="border-t px-5 py-4">
                  {/* Nouvel onglet, et `noopener` comme tout lien sortant. */}
                  <a
                    href={target.menu}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`${t("menuTitle")} — ${t("menuAction")}`}
                    className="group flex items-center gap-3 rounded-2xl border bg-muted/40 p-3 transition-colors hover:bg-muted"
                  >
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-restaurant/15 text-restaurant">
                      <BookOpenText className="size-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold">
                        {t("menuAction")}
                      </span>
                      {menuSource && (
                        <span className="block truncate text-xs text-muted-foreground">
                          {menuSource}
                        </span>
                      )}
                    </span>
                    <ExternalLink className="size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" />
                  </a>
                </div>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
