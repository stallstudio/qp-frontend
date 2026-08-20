import { getPrisma } from "@/lib/prisma";
import type { ParkEventDto } from "@/types/parkEvent";
import type { OpeningHour } from "@/types/openingHour";

/**
 * Événements saisonniers AFFICHABLES d'un parc, pour sa date logique.
 *
 * ⚠️ **On ne filtre PAS sur « en cours en ce moment » côté serveur**, et c'est
 * délibéré : la charge utile passe par `/api/park/[parkId]`, et le calcul
 * dépend de l'heure. On renvoie la fenêtre, le client tranche après montage
 * (voir `lib/park-events.ts`). Le filtre serveur porte sur la PÉRIODE, qui ne
 * change qu'une fois par jour.
 *
 * ⚠️ `active: false` est exclu ici : c'est l'état d'un événement détecté
 * automatiquement mais pas encore confirmé. Ses attractions sont déjà taguées —
 * donc déjà retirées de la liste principale — mais rien ne doit s'afficher.
 *
 * @param openingHours horaires DÉJÀ chargés pour la date logique du parc. Ils
 *   portent l'`eventId` de chaque session : la fenêtre du jour s'en déduit sans
 *   une requête de plus.
 */
export async function getParkEventsByDate(
  parkId: number,
  date: string,
  openingHours: OpeningHour[],
): Promise<ParkEventDto[]> {
  try {
    const prisma = getPrisma();

    const events = await prisma.parkEvent.findMany({
      where: {
        parkId,
        // `hidden` ne quitte jamais le serveur : rien à filtrer côté client, et
        // rien à divulguer non plus.
        visibility: { not: "hidden" },
        OR: [
          // Forcé : chargé quoi qu'il arrive, période connue ou non.
          { visibility: "forced" },
          // Auto : seulement si la période couvre la date logique du parc. Une
          // période inconnue (`null`) ne matche NI `lte` NI `gte` en SQL, donc
          // un événement pas encore daté ne remonte pas — c'est exactement le
          // comportement voulu, sans condition supplémentaire.
          { AND: [{ startDate: { lte: date } }, { endDate: { gte: date } }] },
          // Filet : une session publiée pour aujourd'hui, alors que la période
          // apprise ne la couvre pas encore (la source peut être en avance).
          { id: { in: eventIdsOf(openingHours) } },
        ],
      },
      select: {
        id: true,
        name: true,
        accent: true,
        separateTicket: true,
        startDate: true,
        endDate: true,
        visibility: true,
      },
      orderBy: { startDate: "asc" },
    });

    return events.map((event) => {
      // Session du jour : la ligne d'horaires rattachée à cet événement. Il ne
      // peut y en avoir qu'une par type, et en pratique une seule tout court.
      const session = openingHours.find(
        (h) => h.eventId === event.id && h.openTime && h.closeTime,
      );

      return {
        id: event.id,
        name: event.name,
        accent: event.accent,
        separateTicket: event.separateTicket,
        startsAt: session?.openTime ?? null,
        endsAt: session?.closeTime ?? null,
        startDate: event.startDate,
        endDate: event.endDate,
        visibility: event.visibility as ParkEventDto["visibility"],
        // Comparaison lexicographique, légitime sur du YYYY-MM-DD zéro-paddé.
        // Période inconnue = jamais « dans la période ».
        inPeriod:
          event.startDate !== null &&
          event.endDate !== null &&
          event.startDate <= date &&
          date <= event.endDate,
      };
    });
  } catch (error) {
    // Même politique que les autres lecteurs de cette couche : un événement
    // introuvable ne doit pas emporter la page du parc. Sans événement, la page
    // est exactement celle d'avant la fonctionnalité.
    console.error(`Failed to load events for park ${parkId}`, error);
    return [];
  }
}

function eventIdsOf(openingHours: OpeningHour[]): number[] {
  return openingHours
    .map((h) => h.eventId)
    .filter((id): id is number => typeof id === "number");
}
