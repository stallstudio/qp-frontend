// ————————————————————————————————————————————————————————————————————————
// PROXIMITÉ DE LA FERMETURE DU PARC — règle partagée par les alertes de
// RÉOUVERTURE : le formulaire qui les propose (client), la route qui les crée
// (serveur) et le moteur qui les réarme (cron).
//
// Le problème qu'elle résout : selon les parcs, une attraction qui s'arrête pour
// la nuit ne passe pas forcément en `closed`. Beaucoup la laissent en `down` ou
// en `maintenance` jusqu'au lendemain. Vue du moteur, cette bascule de fin de
// journée est INDISCERNABLE d'une panne — et déclencherait donc, chaque soir, un
// « c'est de nouveau à l'arrêt » qui ne décrit aucun incident.
//
// Le statut de l'attraction ne peut pas trancher : c'est l'HORAIRE DU PARC qui
// le fait. À l'approche de la fermeture, on cesse de traiter un arrêt comme une
// panne.
//
// ⚠️ Ce module est PUR (aucun accès base) pour rester importable depuis un
// composant client. Le chargement des horaires depuis la base vit dans
// `lib/park-closing-db.ts`, qui s'appuie sur les mêmes fonctions.
// ————————————————————————————————————————————————————————————————————————

import { DateTime } from "luxon";

// Deux marges, volontairement différentes.
//
// CRÉATION (1 h) : poser une alerte de réouverture à moins d'une heure de la
// fermeture n'a plus de sens — ce qui s'arrête à ce moment-là s'arrête pour la
// nuit. Le coût d'une erreur est faible : une alerte simplement muette.
//
// RÉARMEMENT (2 h) : marge plus large, car le coût d'une erreur est plus élevé —
// une NOTIFICATION PUSH annonçant une panne qui n'en est pas une. On préfère
// rater un réarmement légitime en toute fin de journée que déranger quelqu'un
// pour la fermeture normale du parc.
//
// L'asymétrie crée une zone (entre 1 h et 2 h avant la fermeture) où l'alerte
// peut être créée mais plus réarmée automatiquement. C'est assumé : elle peut
// toujours NOTIFIER une vraie réouverture jusqu'à la fermeture, et c'est là
// l'essentiel de son utilité.
export const REOPEN_CREATE_CLOSING_MARGIN_MS = 60 * 60_000;
export const REOPEN_REARM_CLOSING_MARGIN_MS = 2 * 60 * 60_000;

export type ParkOpenWindow =
  // Aucun horaire connu pour la période : on ne conclut RIEN. Ne pas confondre
  // avec « fermé » — beaucoup de parcs ne publient pas leurs horaires, et les
  // traiter comme fermés supprimerait la fonctionnalité chez eux.
  | { state: "unknown" }
  // Horaires connus, mais aucune période en cours : le parc est fermé.
  | { state: "closed" }
  | { state: "open"; closeAt: Date };

// Une période d'ouverture, telle qu'elle arrive de la base (Date) ou de l'API
// (chaîne ISO en UTC, comme `types/openingHour.ts`).
export type OpeningPeriod = {
  openTime?: Date | string | null;
  closeTime?: Date | string | null;
  /** Type de la ligne d'horaires (`standard`, `extension`, `event`…). */
  type?: string | null;
  /** Événement saisonnier dont cette ligne est une session. */
  eventId?: number | null;
};

// ————— Quelles périodes comptent, et pour QUI —————
//
// ⚠️ **La journée d'une attraction n'est pas toujours celle de son parc.** Un
// maze de Halloween Horror Nights n'ouvre que pendant la nocturne : jugé sur la
// journée du parc (09:00 – 17:00), il n'a jamais droit à une alerte de
// réouverture au moment précis où il tourne. Inversement, une attraction de jour
// qui s'endort à 17:00 ne doit pas être jugée sur la nocturne, sinon son arrêt du
// soir redevient une « panne ».
//
// ⚠️ **Et l'usage compte autant que l'attraction**, parce que les deux erreurs
// n'ont pas le même prix — c'est déjà ce que disent les deux marges plus haut :
//
//   - `create` : le coût d'une erreur est une alerte MUETTE. On accepte donc la
//     vue la plus large (nocturnes comprises) : pendant l'événement, on peut
//     poser une alerte sur n'importe quelle attraction du parc, au cas où
//     certaines tournent pendant la soirée.
//   - `rearm` : le coût d'une erreur est une NOTIFICATION PUSH annonçant une
//     panne qui n'existe pas. Les attractions ordinaires restent donc jugées sur
//     la seule journée du parc — sans quoi, chaque soir d'octobre, tout le parc
//     s'endormant à 17:00 partirait une salve de « c'est de nouveau à l'arrêt »
//     pendant que la nocturne tourne.
export type ReopenScope = "create" | "rearm";

const EVENT_HOUR_TYPE = "event";

/**
 * Les périodes qui décident du droit à une alerte de réouverture.
 *
 * ⚠️ **`eventId` ne sert QUE pour `rearm`, et l'asymétrie est délibérée.** À la
 * création, la vue est la même pour tout le monde — toutes les périodes — parce
 * qu'il n'y a rien à protéger : une alerte posée trop tôt reste muette et
 * s'efface le soir. Restreindre un maze à ses sessions y ferait même du dégât :
 * le formulaire de la page, qui juge sur les horaires du parc entier, proposerait
 * une alerte que cette route refuserait ensuite — un bouton qui échoue.
 *
 * Au réarmement, au contraire, tout se joue sur la distinction : une attraction
 * ordinaire est jugée sur la journée du parc (nocturnes exclues), un maze sur les
 * sessions de SON événement.
 *
 * ⚠️ Repli sur la journée du parc si l'événement n'a aucune session publiée : un
 * parc peut faire tourner ses mazes sans publier d'horaires de nocturne, et un
 * POI rattaché n'aurait alors plus jamais droit à un réarmement.
 */
export function reopenPeriodsFor(
  periods: OpeningPeriod[],
  { eventId = null, scope }: { eventId?: number | null; scope: ReopenScope },
): OpeningPeriod[] {
  if (scope === "create") return periods;
  if (eventId != null) {
    const sessions = periods.filter((p) => p.eventId === eventId);
    if (sessions.length > 0) return sessions;
  }
  return periods.filter((p) => p.type !== EVENT_HOUR_TYPE);
}

function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

// État d'ouverture d'UN parc à partir de ses périodes. `entries` doit couvrir la
// période courante ; une liste vide vaut « horaires inconnus ».
export function parkOpenWindowFrom(
  entries: OpeningPeriod[],
  now: Date,
): ParkOpenWindow {
  if (entries.length === 0) return { state: "unknown" };

  let closeAt: Date | null = null;
  for (const entry of entries) {
    const open = toDate(entry.openTime);
    const close = toDate(entry.closeTime);
    if (!open || !close) continue;
    if (open > now || close <= now) continue;

    // Période en cours. Plusieurs peuvent se chevaucher (horaires étendus,
    // soirées privées) : on retient la FERMETURE LA PLUS TARDIVE, c'est elle qui
    // borne réellement la journée.
    if (!closeAt || close > closeAt) closeAt = close;
  }

  return closeAt ? { state: "open", closeAt } : { state: "closed" };
}

/**
 * La journée locale `date` (YYYY-MM-DD) est-elle ENCORE EN COURS dans ce parc ?
 *
 * ⚠️ Existe pour l'expiration quotidienne des alertes, qui comparait des dates
 * de CALENDRIER : une alerte posée à 23:50 pendant une nocturne qui court
 * jusqu'à 02:00 était supprimée dix minutes plus tard, en pleine session. Le
 * défaut n'a rien de propre aux événements — tout parc fermant après minuit le
 * subissait — mais il rendrait la fonctionnalité inutilisable le soir.
 *
 * ⚠️ **Toutes les périodes comptent ici, sessions d'événement comprises** :
 * c'est justement ce qui prolonge la journée. Et la période doit avoir OUVERT
 * ce jour-là, sinon l'ouverture du lendemain ferait survivre indéfiniment une
 * alerte de la veille.
 */
export function localDayStillRunning(
  periods: OpeningPeriod[],
  date: string,
  timezone: string,
  now: Date,
): boolean {
  for (const entry of periods) {
    const open = toDate(entry.openTime);
    const close = toDate(entry.closeTime);
    if (!open || !close) continue;
    if (open > now || close <= now) continue;
    const openDay = DateTime.fromJSDate(open).setZone(timezone).toISODate();
    if (openDay === date) return true;
  }
  return false;
}

// Une alerte de réouverture a-t-elle encore un sens pour ce parc, à cet instant ?
// `marginMs` : voir les deux constantes plus haut.
export function reopenAllowedForWindow(
  window: ParkOpenWindow | undefined,
  now: Date,
  marginMs: number,
): boolean {
  // Horaires inconnus : on laisse faire. Refuser sur une absence de donnée
  // désactiverait la fonctionnalité pour tous les parcs qui ne publient pas
  // leurs horaires, sans qu'aucun signal ne dise que c'était justifié.
  if (!window || window.state === "unknown") return true;
  if (window.state === "closed") return false;
  return window.closeAt.getTime() - now.getTime() > marginMs;
}
