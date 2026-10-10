"use client";

import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { useFavoritesContext } from "@/components/providers/favorites-provider";
import { poiFavorite } from "@/lib/favorites-storage";
import AttractionDetailDialog from "@/components/parks/attraction-detail/attraction-detail-dialog";
import PoiDetailDialog from "@/components/parks/poi-detail/poi-detail-dialog";
import EventExtrasList from "@/components/parks/event-extras-list";
import ScheduleGrid, {
  type GridRow,
} from "@/components/parks/show-time-table/schedule-grid";
import type { PoiHours } from "@/types/poiHours";
import type { WaitTime } from "@/types/waitTime";

type PoiHoursTableProps = {
  items: PoiHours[];
  timezone: string;
  parkDate?: string | null;
  parkIdentifier: string;
  parkName: string;
  /**
   * Les relevés en direct du parc : le popup d'une ligne est celui de
   * l'onglet « En direct » quand le POI y figure (état, alertes, graphique).
   */
  waitTimes: WaitTime[];
  /**
   * POI de la famille SANS heures du jour, listés sous la grille avec
   * l'intertitre « Horaires non publiés » — les restaurants du Parc Astérix
   * hors des trois restaurants à table. Même forme que les spectacles sans
   * séance d'une carte d'événement.
   */
  unlisted?: WaitTime[];
  reopenAllowed?: boolean;
};

/**
 * Les heures d'ouverture du jour d'une famille de POI, sur la grille des
 * spectacles : une ligne par POI, une barre par créneau.
 *
 * ⚠️ **Trié sur la FERMETURE, la plus tardive en tête** (arbitré le
 * 2026-10-06) : ce que le visiteur cherche dans cette liste, c'est ce qui sera
 * encore ouvert ce soir. Les favoris restent épinglés au-dessus, à égalité
 * l'alphabet départage — ceux de chaque famille depuis le 2026-10-09, et plus
 * seulement les attractions.
 */
export default function PoiHoursTable({
  items,
  timezone,
  parkDate,
  parkIdentifier,
  parkName,
  waitTimes,
  unlisted = [],
  reopenAllowed = true,
}: PoiHoursTableProps) {
  const t = useTranslations("poiDetail");
  const tShowDetail = useTranslations("showDetail");
  const { favorites } = useFavoritesContext();
  const isFavorite = (poi: WaitTime) => {
    const { namespace, key } = poiFavorite(parkIdentifier, {
      id: poi.rideId,
      name: poi.rideName,
      kind: poi.kind,
    });
    return favorites[namespace].has(key);
  };
  const [detailPoiId, setDetailPoiId] = useState<number | null>(null);

  const rows = useMemo(() => {
    const keyed = items.map((item) => {
      const { namespace, key } = poiFavorite(parkIdentifier, {
        id: item.poiId,
        name: item.name,
        kind: item.kind,
      });
      return {
        item,
        fav: favorites[namespace].has(key),
        closesAt: Math.max(...item.slots.map((s) => Date.parse(s.closeTime))),
      };
    });

    keyed.sort((a, b) => {
      if (a.fav !== b.fav) return a.fav ? -1 : 1;
      if (a.closesAt !== b.closesAt) return b.closesAt - a.closesAt;
      return a.item.name.localeCompare(b.item.name);
    });

    return keyed.map(({ item, fav }): GridRow => ({
      uid: String(item.poiId),
      name: item.name,
      favorite: fav,
      ariaLabel: t("openFor", { poi: item.name }),
      duration: 0,
      schedules: item.slots.map((slot) => ({
        startTime: slot.openTime,
        endTime: slot.closeTime,
      })),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, favorites, parkIdentifier]);

  // Le popup : celui du direct si le POI y figure, sinon le même popup bâti
  // sur la seule fiche du POI — sans état, puisqu'on n'en a pas relevé.
  const detail = useMemo((): WaitTime | null => {
    if (detailPoiId == null) return null;
    const live =
      waitTimes.find((wt) => wt.rideId === detailPoiId) ??
      unlisted.find((wt) => wt.rideId === detailPoiId);
    if (live) return live;
    const item = items.find((i) => i.poiId === detailPoiId);
    if (!item) return null;
    return {
      rideId: item.poiId,
      rideName: item.name,
      queues: [],
      eventId: item.eventId,
      banner: item.banner,
      kind: item.kind,
      zone: item.zone,
      menu: item.menu,
      fearLevel: item.fearLevel,
      price: item.price,
    };
  }, [detailPoiId, waitTimes, unlisted, items]);

  const close = (open: boolean) => {
    if (!open) setDetailPoiId(null);
  };

  return (
    <>
      {rows.length > 0 && (
        <ScheduleGrid
          rows={rows}
          timezone={timezone}
          parkDate={parkDate}
          showRange
          onActivate={(uid) => setDetailPoiId(Number(uid))}
        />
      )}

      {/* Toujours titrée, même seule : c'est ce qui dit qu'on ne connaît pas
          leurs heures, et non qu'ils sont fermés. */}
      {unlisted.length > 0 && (
        <EventExtrasList
          items={unlisted.map((poi) => ({
            id: poi.rideId,
            name: poi.rideName,
            favorite: isFavorite(poi),
          }))}
          heading={tShowDetail("unscheduledTitle")}
          detached={rows.length > 0}
          ariaLabel={(poi) => t("openFor", { poi })}
          onActivate={(id) => setDetailPoiId(id)}
        />
      )}

      <AttractionDetailDialog
        target={detail?.kind === "ride" ? detail : null}
        parkIdentifier={parkIdentifier}
        parkName={parkName}
        reopenAllowed={reopenAllowed}
        onOpenChange={close}
      />
      <PoiDetailDialog
        target={detail && detail.kind !== "ride" ? detail : null}
        parkIdentifier={parkIdentifier}
        parkName={parkName}
        reopenAllowed={reopenAllowed}
        onOpenChange={close}
      />
    </>
  );
}
