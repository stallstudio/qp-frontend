// ————————————————————————————————————————————————————————————————————————
// CRÉNEAUX DE SPECTACLE — rattachement à la SÉANCE qui les contient
//
// Module PUR (aucun accès base), comme `lib/park-closing.ts` et
// `lib/park-events.ts`. Le chargement vit dans `lib/park-live-data.ts`.
//
// Le problème qu'il résout : **une nocturne à cheval sur minuit est coupée en
// deux par le calendrier, pas par l'exploitation.** Halloween Horror Nights
// tourne de 19:00 à 01:00 ; ses dernières représentations portent donc la date
// du LENDEMAIN, et celles de la veille portent celle d'AUJOURD'HUI.
//
// Sans ce module, la page d'Universal Studios Florida affichait le 25/08 à 16:00
// les représentations de 00:00, 00:30 et 00:45 — la fin de la nuit du 24 —
// grisées, sous une carte annonçant « Ouvre à 19:00 ». Et à l'inverse, une fois
// minuit passé, les représentations de la nuit EN COURS disparaissaient de la
// grille : elles étaient datées du jour d'après, que personne ne chargeait.
//
// La règle est donc celle de la source, jamais une liste d'exceptions : **un
// créneau appartient à la séance qui le contient**, et les séances sont les
// horaires d'ouverture du jour logique, nocturnes comprises.
// ————————————————————————————————————————————————————————————————————————

import type { OpeningHour } from "@/types/openingHour";
import type { ShowTime } from "@/types/show";

/**
 * Tolérance autour d'une séance.
 *
 * Les sources publient couramment un créneau un peu AVANT l'ouverture officielle
 * (rencontres de personnages à l'ouverture des portes, pré-shows) ou un peu
 * après la fermeture. Coller à la minute couperait ces créneaux-là, qui sont
 * pourtant bien ceux de la journée.
 *
 * ⚠️ Une heure ne peut pas rattraper la séance de la veille : entre la fermeture
 * d'un soir et l'ouverture du lendemain il y a au minimum plusieurs heures, même
 * pour une nocturne qui finit à 01:00 (le parc rouvre au plus tôt vers 08:00).
 */
const SESSION_TOLERANCE_MS = 60 * 60_000;

type Session = { open: number; close: number };

function toSession(hour: OpeningHour): Session | null {
  if (!hour.openTime || !hour.closeTime) return null;
  const open = new Date(hour.openTime).getTime();
  const close = new Date(hour.closeTime).getTime();
  if (Number.isNaN(open) || Number.isNaN(close) || close <= open) return null;
  return { open, close };
}

function within(sessions: Session[], instant: number): boolean {
  return sessions.some(
    (s) =>
      instant >= s.open - SESSION_TOLERANCE_MS &&
      instant <= s.close + SESSION_TOLERANCE_MS,
  );
}

/**
 * Ne garde de chaque spectacle que les créneaux qui tombent dans une séance du
 * jour logique du parc. Un spectacle qui n'en garde aucun DISPARAÎT de la liste.
 *
 * ⚠️ C'est voulu, et c'est la moitié du correctif : une carte d'événement sans
 * représentation ne se rend pas (voir `main-card.tsx`). Mieux vaut aucune grille
 * qu'une grille montrant la nuit précédente sous un en-tête qui annonce celle du
 * soir.
 *
 * ⚠️ **Un spectacle tagué `eventId` n'est confronté qu'aux séances de SON
 * événement**, jamais à la journée : c'est ce qui retire les représentations de
 * la nuit précédente, qui tombent dans les heures d'ouverture d'aujourd'hui sans
 * appartenir à sa nocturne.
 *
 * ⚠️ **Un spectacle NON tagué, lui, est confronté à TOUTES les séances**, y
 * compris nocturnes. Restreindre à l'exploitation de jour paraissait plus
 * propre, mais supprimerait les représentations de 23:00 d'un parc dont la
 * nocturne existe et dont les spectacles ne sont, eux, pas tagués — un cas de
 * données incomplètes ne doit pas faire disparaître de la donnée juste.
 *
 * @param openingHours horaires du JOUR LOGIQUE du parc, `eventId` compris.
 *   Vide (parc qui ne publie pas ses horaires) : rien n'est filtré, faute de
 *   quoi la fonctionnalité disparaîtrait chez lui.
 */
export function limitShowsToSessions(
  shows: ShowTime[],
  openingHours: OpeningHour[],
): ShowTime[] {
  // Toutes les séances du jour logique, nocturnes comprises : la fenêtre par
  // défaut, celle des spectacles que rien ne rattache à un événement.
  const allSessions = openingHours
    .map(toSession)
    .filter((s): s is Session => s !== null);

  // Séances d'événement, par événement.
  const eventSessions = new Map<number, Session[]>();
  for (const hour of openingHours) {
    if (typeof hour.eventId !== "number") continue;
    const session = toSession(hour);
    if (!session) continue;
    const list = eventSessions.get(hour.eventId);
    if (list) list.push(session);
    else eventSessions.set(hour.eventId, [session]);
  }

  const kept: ShowTime[] = [];

  for (const show of shows) {
    const sessions =
      show.eventId != null
        ? (eventSessions.get(show.eventId) ?? [])
        : allSessions;

    // Aucune séance connue : on ne sait pas trancher, donc on ne tranche pas —
    // les créneaux passent tels qu'ils ont été chargés. Le cas courant est un
    // parc qui ne publie aucun horaire : filtrer y viderait la grille sans
    // qu'aucun signal ne dise pourquoi.
    //
    // ⚠️ Un événement dont la source ne publie pas la nocturne retombe ici, et
    // garde donc les restes de la veille. C'est le moindre mal tant que le
    // worker ne les a pas re-datés sur leur journée d'EXPLOITATION (voir
    // `showService.saveShowTimes`) : sans horaire ni date fiable, rien ne
    // distingue une représentation d'hier d'une de ce soir.
    if (sessions.length === 0) {
      kept.push(show);
      continue;
    }

    const schedules = show.schedules.filter((schedule) => {
      const start = new Date(schedule.startTime).getTime();
      return !Number.isNaN(start) && within(sessions, start);
    });

    if (schedules.length > 0) kept.push({ ...show, schedules });
  }

  return kept;
}
