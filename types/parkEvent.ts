/**
 * Un événement saisonnier d'un parc (Halloween, Noël), tel que le frontend le
 * reçoit.
 *
 * ⚠️ **On transporte la FENÊTRE, jamais un booléen « en cours ».** Deux raisons,
 * et les deux ont déjà mordu ailleurs dans ce dépôt :
 *
 *  1. `/api/parks` est servie derrière un `s-maxage` PARTAGÉ. Un booléen calculé
 *     au moment du rendu resterait figé dans le cache : un événement fermé
 *     depuis une minute s'afficherait encore « en cours » pour tous les
 *     visiteurs suivants.
 *  2. « Sommes-nous dans la fenêtre ? » dépend de l'heure courante, qui n'est
 *     pas la même sous Node et dans le navigateur — le calculer au rendu
 *     produirait une erreur d'hydratation sur tout parc pile sur la limite.
 *
 * Le client tranche donc lui-même, après montage.
 */
export type ParkEventDto = {
  id: number;
  /**
   * Nom affiché, NON TRADUIT : il vient de la source, comme un nom
   * d'attraction. « Traumatica », pas « Événement Halloween ».
   */
  name: string;
  /** Famille visuelle : "halloween" | "christmas" | null. */
  accent: string | null;
  /** Billet distinct de l'entrée du parc. */
  separateTicket: boolean;

  /**
   * Sessions du JOUR, en instants absolus (ISO UTC), triées par ouverture,
   * telles que les horaires du parc les décrivent. Vide quand l'événement ne
   * tourne pas aujourd'hui — ou quand le parc n'en publie pas les horaires, cas
   * où seule la période ci-dessous est connue.
   *
   * ⚠️ **Une LISTE, pas une session.** Peur sur le Parc tourne deux fois certains
   * jours : en journée (9 h – 18 h, billet normal) puis en nocturne (19 h – 1 h,
   * billet à part), les maisons hantées ouvertes aux deux. Réduite à sa première
   * session, la carte restait repliée toute la soirée.
   */
  sessions: { startsAt: string; endsAt: string }[];

  /**
   * Période de l'événement, en dates LOCALES du parc (YYYY-MM-DD). Sert quand la
   * source ne publie pas d'horaires : sans elle, un événement muet sur ses
   * nocturnes n'aurait jamais de fenêtre, donc jamais de carte.
   *
   * `null` = période inconnue : l'événement est détecté et ses attractions sont
   * rattachées, mais personne n'a encore dit quand il tourne.
   */
  startDate: string | null;
  endDate: string | null;

  /**
   * Politique d'affichage décidée dans l'admin.
   *
   * - `auto` : la carte suit la période et les horaires (le cas normal) ;
   * - `forced` : la carte s'affiche toujours, même hors période ;
   * - `hidden` : jamais. Filtré côté serveur, jamais transporté.
   */
  visibility: "auto" | "forced" | "hidden";

  /**
   * La date locale du parc tombe-t-elle dans la période ? Calculé SERVEUR, à
   * partir de la date logique du parc — donc stable entre le rendu Node et
   * l'hydratation, contrairement à tout ce qui dépend de l'heure.
   *
   * `false` si la période est inconnue.
   */
  inPeriod: boolean;

  /**
   * La source a publié des sessions APRÈS la date locale du parc, mais aucune
   * pour aujourd'hui : son calendrier SAUTE ce jour-là. Calculé serveur, comme
   * `inPeriod`.
   *
   * ⚠️ **C'est ce qui distingue « soir de relâche » de « horaires non publiés ».**
   * La période n'est qu'un filet pour les parcs muets sur leurs nocturnes ; elle
   * ne dit pas quels soirs l'événement tourne. Constaté le 2026-10-02 à Movie
   * World : Fright Nights publiait ses 9 soirées (du 3 au 31 octobre, vendredis
   * et samedis), mais la période 29/09 → 31/10 couvrait le jeudi 2, et la carte
   * affichait « Aujourd'hui » un soir sans événement.
   *
   * Seules des sessions POSTÉRIEURES comptent : une source qui ne publie que le
   * jour même (Traumatica chez Mack) n'a pas encore écrit la ligne du jour au
   * premier passage, et son absence ne prouve rien.
   */
  skipsToday: boolean;
};
