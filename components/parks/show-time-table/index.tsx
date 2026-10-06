"use client";

import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { useFavorites } from "@/hooks/useFavorites";
import { useMinuteClock } from "@/hooks/useMinuteClock";
import {
  showReminderKey,
  useNotifications,
} from "@/components/providers/notifications-provider";
import ShowDetailDialog from "@/components/parks/show-detail/show-detail-dialog";
import type { ShowTime } from "@/types/show";

import { ShowTimeTableProps } from "./types";
import { compareShowSortKeys, showSortKey } from "./utils";
import ScheduleGrid, { type GridRow } from "./schedule-grid";

export default function ParkShowTimeTable({
  shows,
  timezone,
  parkDate,
  parkIdentifier,
  parkName,
}: ShowTimeTableProps) {
  const tShowDetail = useTranslations("showDetail");

  // isFavorite sert à épingler les favoris en tête ; le (dé)favori se fait
  // désormais depuis le popup, comme pour les attractions.
  const { isFavorite } = useFavorites("shows");
  const favKey = (showName: string) => `${parkIdentifier}:${showName}`;

  // Spectacles avec un rappel programmé : une cloche les signale dans la liste.
  const { reminderShowKeys } = useNotifications();
  const [detailTarget, setDetailTarget] = useState<ShowTime | null>(null);
  const now = useMinuteClock();

  // ————— L'ordre : favoris, puis la prochaine représentation en haut —————
  //
  // Arbitré le 2026-10-06 : la liste se lit comme un programme qui avance. Ce
  // qui va se jouer le plus tôt est en tête, et une représentation qui se
  // termine fait descendre son spectacle — en glissant, comme une attraction
  // dont le temps d'attente change (voir `orderKey` dans la grille). Ce qui a
  // tout joué finit en bas, le plus récent d'abord.
  //
  // `now` vaut `null` pendant l'hydratation (voir `useMinuteClock`) : l'ordre
  // retombe alors sur l'alphabet, identique au serveur et au navigateur.
  //
  // ⚠️ L'index de tri alphabétique est suffixé à l'uid : deux spectacles
  // peuvent porter le MÊME nom (« Rencontre avec les personnages » sur deux
  // scènes), le nom seul ne ferait pas une clé unique. Calculé AVANT le tri
  // horaire, pour que la clé d'une ligne ne change pas quand elle se déplace.
  const { rows, byUid } = useMemo(() => {
    const alphabetical = [...shows]
      .sort((a, b) => a.showName.localeCompare(b.showName))
      .map((show, index) => ({ show, uid: `${index}::${show.showName}` }));

    const keyed = alphabetical.map((item, index) => ({
      ...item,
      index,
      fav: isFavorite(favKey(item.show.showName)),
      key: now === null ? null : showSortKey(item.show, timezone, now),
    }));

    keyed.sort((a, b) => {
      if (a.fav !== b.fav) return a.fav ? -1 : 1;
      if (a.key && b.key) {
        const byTime = compareShowSortKeys(a.key, b.key);
        if (byTime !== 0) return byTime;
      }
      return a.index - b.index;
    });

    const gridRows: GridRow[] = keyed.map(({ show, uid, fav }) => ({
      uid,
      name: show.showName,
      favorite: fav,
      bellLabel: reminderShowKeys.has(
        showReminderKey(parkIdentifier, show.showName),
      )
        ? tShowDetail("reminderScheduled")
        : undefined,
      ariaLabel: tShowDetail("openFor", { show: show.showName }),
      duration: show.duration,
      schedules: show.schedules,
    }));

    return {
      rows: gridRows,
      byUid: new Map(alphabetical.map(({ show, uid }) => [uid, show])),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shows, isFavorite, reminderShowKeys, now, timezone, parkIdentifier]);

  return (
    <>
      <ScheduleGrid
        rows={rows}
        timezone={timezone}
        parkDate={parkDate}
        onActivate={(uid) => setDetailTarget(byUid.get(uid) ?? null)}
      />

      {/* Popup « détail spectacle », ouvert par un clic sur une ligne. */}
      <ShowDetailDialog
        target={detailTarget}
        parkIdentifier={parkIdentifier}
        parkName={parkName}
        timezone={timezone}
        onOpenChange={(open) => {
          if (!open) setDetailTarget(null);
        }}
      />
    </>
  );
}
