import { DateTime } from "luxon";
import { getPrisma } from "@/lib/prisma";
import { OpeningHour } from "@/types/openingHour";

type Park = {
  id: number;
  timezone: string;
  identifier: string;
};

type CloseTimeEntry = { closeTime: Date | string | null };

const SAFE_AFTER_CLOSE_HOUR = 5;

export function resolveParkLogicalDate(
  timezone: string,
  yesterdayHours: CloseTimeEntry[],
): string | null {
  const now = DateTime.now().setZone(timezone);
  if (!now.isValid) return null;

  const today = now.toISODate();
  const yesterday = now.minus({ days: 1 }).toISODate();
  if (!today || !yesterday) return null;

  if (yesterdayHours.length === 0) return today;

  let latestClose: DateTime | null = null;
  for (const entry of yesterdayHours) {
    const ct = entry.closeTime;
    if (!ct) continue;
    const closeDt =
      typeof ct === "string"
        ? DateTime.fromISO(ct, { zone: "utc" }).setZone(timezone)
        : DateTime.fromJSDate(ct).setZone(timezone);
    if (!closeDt.isValid) continue;
    if (!latestClose || closeDt > latestClose) latestClose = closeDt;
  }

  if (!latestClose) return today;

  const midnightToday = DateTime.fromISO(today, { zone: timezone }).startOf(
    "day",
  );

  if (latestClose > midnightToday && now < latestClose) {
    return yesterday;
  }
  return today;
}

export async function calculateParkDate(
  parkId: number,
  timezone: string,
): Promise<string | null> {
  try {
    const now = DateTime.now().setZone(timezone);
    if (!now.isValid) return null;

    const today = now.toISODate();
    if (!today) return null;

    if (now.hour >= SAFE_AFTER_CLOSE_HOUR) {
      return today;
    }

    const yesterday = now.minus({ days: 1 }).toISODate();
    if (!yesterday) return null;

    const prisma = getPrisma();
    const yesterdayHours = await prisma.openingHours.findMany({
      where: { parkId, date: yesterday },
      select: { closeTime: true },
    });

    return resolveParkLogicalDate(timezone, yesterdayHours);
  } catch (error) {
    console.warn(`Invalid timezone: ${timezone}`, error);
    return null;
  }
}

export async function fetchOpeningHoursForParks(
  parks: Park[],
): Promise<Map<number, OpeningHour[]>> {
  const prisma = getPrisma();

  type ParkDates = {
    park: Park;
    today: string;
    yesterday: string;
    now: DateTime;
  };

  const parkDates: ParkDates[] = [];
  for (const park of parks) {
    const now = DateTime.now().setZone(park.timezone);
    if (!now.isValid) {
      console.warn(
        `Invalid timezone for park ${park.identifier}: ${park.timezone}`,
      );
      continue;
    }
    const today = now.toISODate();
    const yesterday = now.minus({ days: 1 }).toISODate();
    if (!today || !yesterday) continue;
    parkDates.push({ park, today, yesterday, now });
  }

  if (parkDates.length === 0) {
    return new Map();
  }

  const orFilters: { parkId: number; date: string }[] = [];
  for (const pd of parkDates) {
    orFilters.push({ parkId: pd.park.id, date: pd.today });
    if (pd.now.hour < SAFE_AFTER_CLOSE_HOUR) {
      orFilters.push({ parkId: pd.park.id, date: pd.yesterday });
    }
  }

  const allOpeningHours = await prisma.openingHours.findMany({
    where: { OR: orFilters },
    select: {
      parkId: true,
      date: true,
      type: true,
      openTime: true,
      closeTime: true,
      label: true,
      eventId: true,
    },
    orderBy: { type: "asc" },
  });

  const byParkAndDate = new Map<number, Map<string, typeof allOpeningHours>>();
  for (const oh of allOpeningHours) {
    if (!byParkAndDate.has(oh.parkId)) {
      byParkAndDate.set(oh.parkId, new Map());
    }
    const dateMap = byParkAndDate.get(oh.parkId)!;
    if (!dateMap.has(oh.date)) {
      dateMap.set(oh.date, []);
    }
    dateMap.get(oh.date)!.push(oh);
  }

  const result = new Map<number, OpeningHour[]>();
  for (const pd of parkDates) {
    const dateMap = byParkAndDate.get(pd.park.id);
    let resolvedDate: string;

    if (pd.now.hour >= SAFE_AFTER_CLOSE_HOUR) {
      resolvedDate = pd.today;
    } else {
      const yesterdayEntries = dateMap?.get(pd.yesterday) ?? [];
      resolvedDate =
        resolveParkLogicalDate(pd.park.timezone, yesterdayEntries) ?? pd.today;
    }

    // ⚠️ **Repli sur la veille quand la journée résolue n'a AUCUNE ligne.**
    // Les horaires d'un jour sont écrits par le passage horaire du worker qui
    // SUIT minuit local (mesuré sur une semaine : entre 00:00 et 00:08 heure du
    // parc), et `getParksWithHours()` mémorise la liste 5 min de plus. Chaque
    // parc traverse donc chaque nuit une fenêtre d'une dizaine de minutes où
    // « aujourd'hui » n'existe pas encore en base.
    //
    // `getParkStatus` y répondait `unknown`, et `unknown` n'affiche RIEN — ni
    // pastille dans la liste, ni badge sur la page parc. Un parc sans donnée
    // était donc indiscernable d'un bug de rendu. Vu en vrai sur les parcs
    // chinois à 00:12 heure de Shanghai, pendant que le Japon — minuit passé
    // depuis plus d'une heure — affichait bien ses pastilles rouges.
    //
    // La veille répond juste dans les deux cas : soit sa fermeture est passée
    // (« fermé », la bonne réponse à minuit passé), soit elle déborde sur la
    // nuit (« ouvert », tout aussi juste). Le repli ne peut rien élargir hors
    // de cette fenêtre : la veille n'est même pas chargée au-delà de
    // `SAFE_AFTER_CLOSE_HOUR` (voir `orFilters`).
    //
    // ⚠️ Ne vaut QUE pour la pastille : `ParkList.openingHours` n'est jamais
    // affiché en clair. Les horaires lisibles de la page parc viennent de
    // `buildParkLiveData`, qui ne doit surtout pas afficher ceux de la veille.
    //
    // ⚠️ **TROIS verrous, et le test d'heure est écrit ICI exprès.** Un parc
    // dont les horaires manquent à MIDI ne doit surtout pas hériter de ceux de
    // la veille : à cette heure-là ils diraient « ouvert » ou « fermé » sans
    // rien savoir de la journée en cours, et un parc qui a changé ses horaires
    // afficherait l'état d'hier. Le repli est donc borné à la nuit :
    //
    //   1. `now.hour < SAFE_AFTER_CLOSE_HOUR` — la seule tranche où le trou
    //      existe. Le test est explicite plutôt que déduit d'`orFilters` (qui
    //      ne charge la veille que dans cette tranche) : élargir un jour le
    //      chargement ne doit pas élargir le repli par effet de bord.
    //   2. `resolvedDate !== pd.yesterday` — un parc encore ouvert après
    //      minuit a DÉJÀ la veille comme journée logique, il n'y a rien à
    //      replier.
    //   3. Conséquence des deux : la veille a forcément fermé avant minuit
    //      (sinon `resolveParkLogicalDate` l'aurait retenue), donc le repli ne
    //      peut produire que « fermé ». Il ne peut pas allumer une pastille
    //      verte à tort.
    let entries = dateMap?.get(resolvedDate) ?? [];
    if (
      entries.length === 0 &&
      pd.now.hour < SAFE_AFTER_CLOSE_HOUR &&
      resolvedDate !== pd.yesterday
    ) {
      entries = dateMap?.get(pd.yesterday) ?? [];
    }

    result.set(
      pd.park.id,
      entries.map((entry) => ({
        date: entry.date,
        type: entry.type,
        openTime: entry.openTime ? entry.openTime.toISOString() : null,
        closeTime: entry.closeTime ? entry.closeTime.toISOString() : null,
        label: entry.label,
        eventId: entry.eventId,
      })),
    );
  }

  return result;
}

export async function getOpeningHoursByParkAndDate(
  parkId: number,
  date: string,
): Promise<OpeningHour[]> {
  try {
    const prisma = getPrisma();

    const entries = await prisma.openingHours.findMany({
      where: {
        parkId,
        date,
      },
    });

    return entries.map((entry) => ({
      date: entry.date,
      type: entry.type,
      openTime: entry.openTime ? entry.openTime.toISOString() : null,
      closeTime: entry.closeTime ? entry.closeTime.toISOString() : null,
      label: entry.label,
      eventId: entry.eventId,
    }));
  } catch (error) {
    return [];
  }
}
