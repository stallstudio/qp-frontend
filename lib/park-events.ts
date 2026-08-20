// ————————————————————————————————————————————————————————————————————————
// ÉVÉNEMENTS SAISONNIERS — état d'affichage
//
// Module PUR (aucun accès base), importable depuis un composant client — même
// séparation que `lib/park-closing.ts`. Le chargement vit dans
// `lib/park-live-data.ts`.
//
// Il répond à une seule question, et c'est le client qui la pose après montage :
// **dans quel état la carte de cet événement doit-elle être, maintenant ?**
// ————————————————————————————————————————————————————————————————————————

import type { ParkEventDto } from "@/types/parkEvent";
import type { OpeningHour } from "@/types/openingHour";

/**
 * Les trois états de la carte d'un événement.
 *
 * ⚠️ `hidden` n'est pas « replié avec un contenu vide » : la carte ne se rend
 * PAS DU TOUT. C'est ce qui rend la fonctionnalité temporaire sans surveillance
 * — onze mois par an, la page d'un parc est exactement celle d'aujourd'hui, et
 * il n'y a rien à éteindre en novembre.
 */
export type ParkEventState = "hidden" | "collapsed" | "running";

export type ParkEventView = {
  event: ParkEventDto;
  state: ParkEventState;
  /** Prochaine ouverture (état `collapsed`) ou fermeture (état `running`). */
  boundary: Date | null;
};

function toDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * État d'UN événement à un instant donné.
 *
 * ⚠️ **`at` est passé en argument, jamais lu depuis `Date.now()` ici.** C'est ce
 * qui permet à l'appelant de retarder l'évaluation après le montage : l'heure
 * courante n'est pas la même sous Node et dans le navigateur, et un événement
 * pile sur sa limite ferait diverger les deux rendus.
 */
export function parkEventStateAt(
  event: ParkEventDto,
  at: Date,
): ParkEventView {
  const startsAt = toDate(event.startsAt);
  const endsAt = toDate(event.endsAt);

  // `hidden` : jamais, quoi qu'il arrive. Le serveur ne transporte normalement
  // pas ces événements — la garde est ici par sécurité, pas par nécessité.
  if (event.visibility === "hidden") {
    return { event, state: "hidden", boundary: null };
  }

  // `forced` : la carte s'affiche TOUJOURS. On continue quand même le calcul
  // ci-dessous, pour qu'une session connue la déplie au bon moment — forcer
  // l'affichage ne veut pas dire forcer l'ouverture.
  const forced = event.visibility === "forced";

  // Hors période ET sans session aujourd'hui : rien à montrer.
  //
  // Les deux conditions comptent. Un événement peut avoir une session publiée
  // pour une date que sa période ne couvre pas encore (la source est en avance
  // sur ce qu'on a appris) ; l'inverse est le cas courant d'un parc qui ne
  // publie pas ses nocturnes.
  //
  // ⚠️ C'est aussi ici que tombe un événement DÉTECTÉ MAIS PAS ENCORE DATÉ :
  // `inPeriod` est faux quand la période est inconnue. Ses attractions sont déjà
  // retirées de la liste principale, mais aucune carte n'apparaît — c'est ce qui
  // empêche une maison de Halloween Horror Nights publiée en août de s'afficher
  // trois semaines trop tôt.
  if (!forced && !event.inPeriod && !startsAt) {
    return { event, state: "hidden", boundary: null };
  }

  // Session connue : elle tranche.
  if (startsAt && endsAt) {
    if (at >= startsAt && at < endsAt) {
      return { event, state: "running", boundary: endsAt };
    }
    // Avant l'ouverture du soir : replié, avec l'heure d'ouverture.
    if (at < startsAt) {
      return { event, state: "collapsed", boundary: startsAt };
    }
    // Session terminée. On reste REPLIÉ plutôt que de disparaître : la carte ne
    // pèse qu'une ligne d'en-tête, et la faire disparaître à 23:30 retirerait de
    // la page, sans prévenir, les attractions qu'on y regardait à 23:29.
    return { event, state: "collapsed", boundary: null };
  }

  // Dans la période, mais aucun horaire publié : replié, sans heure. C'est la
  // meilleure réponse possible — on sait que l'événement a lieu, on ne sait pas
  // quand il ouvre, et inventer une heure serait pire que ne rien dire.
  return { event, state: "collapsed", boundary: null };
}

/**
 * Les événements d'un parc, du plus « chaud » au plus froid : en cours d'abord,
 * puis repliés. À l'intérieur d'un même état, l'ordre de la base est conservé.
 *
 * ⚠️ Les événements `hidden` sont RETIRÉS, pas triés en dernier : un appelant
 * qui les recevrait finirait par en rendre un.
 */
export function visibleParkEvents(
  events: ParkEventDto[],
  at: Date,
): ParkEventView[] {
  return events
    .map((event) => parkEventStateAt(event, at))
    .filter((view) => view.state !== "hidden")
    .sort((a, b) => {
      if (a.state === b.state) return 0;
      return a.state === "running" ? -1 : 1;
    });
}

/**
 * Types d'horaires qui ne décrivent PAS l'exploitation de jour du parc.
 *
 * ⚠️ **`event` s'ajoute ici, et c'est le vrai travail de la fonctionnalité.**
 * Une ligne d'horaires ne sert pas qu'à la pastille ouvert/fermé : elle borne
 * aussi les alertes de réouverture, le profil de prévision et l'axe du graphique
 * du jour. Une nocturne qui court jusqu'à 1 h du matin :
 *
 *   - rouvrirait le droit aux alertes de réouverture sur TOUTES les attractions,
 *     y compris celles de jour arrêtées pour la nuit — soit exactement le piège
 *     « la fin de journée est indiscernable d'une panne » ;
 *   - étirerait l'axe du graphique d'une attraction de jour jusqu'à 1 h.
 *
 * L'oublier ne casse rien visiblement : ça dégrade silencieusement et fait
 * partir de mauvaises notifications.
 *
 * ⚠️ `extension` n'y est PAS : même billet, même exploitation, c'est une vraie
 * journée qui se prolonge.
 */
export const NON_DAY_HOUR_TYPES = new Set(["private_event", "sold_out", "event"]);

/** Les horaires qui décrivent la journée d'exploitation du parc. */
export function dayOpeningHours(hours: OpeningHour[]): OpeningHour[] {
  return hours.filter((h) => !NON_DAY_HOUR_TYPES.has(h.type));
}
