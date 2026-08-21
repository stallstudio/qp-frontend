export type WaitTimeStatus = "open" | "closed" | "down" | "maintenance";

export type TimeSlot = {
  start: string; // "HH:mm" (24h, heure locale du parc)
  end: string;   // "HH:mm" (24h, heure locale du parc)
};

export type QueueTime = {
  type: string;
  waitTime: number;
  status: WaitTimeStatus;
  timeSlot: TimeSlot | null;
};

export type WaitTime = {
  rideId: number;
  rideName: string;
  queues: QueueTime[];
  /**
   * Événement saisonnier dont cette attraction fait partie (un maze). `null`
   * pour la quasi-totalité du catalogue.
   *
   * ⚠️ **Une attraction taguée n'apparaît QUE dans la carte de son événement**,
   * jamais dans la liste principale — y compris hors période, où la carte ne se
   * rend pas et où l'attraction disparaît donc de la page.
   *
   * ⚠️ Aucune requête supplémentaire pour l'obtenir : `getLatestWaitTimesByPark`
   * fait déjà `include: { ride: true }`.
   */
  eventId: number | null;
  /**
   * Image publiée par la SOURCE du parc pour cette attraction. `null` pour la
   * quasi-totalité du catalogue : seules les sources qui en publient une la
   * remplissent (les parcs Compagnie des Alpes aujourd'hui).
   *
   * ⚠️ **C'est un chemin LOCAL signé** (`/api/image?...`), pas l'URL du parc :
   * elle transite par notre domaine pour ne pas avoir à déclarer l'hôte de
   * chaque parc dans `next.config.ts`. Voir `lib/image-proxy.ts`.
   *
   * ⚠️ L'image vient du parc, jamais de nous — d'où le crédit affiché
   * par-dessus, à son nom.
   *
   * ⚠️ Aucune requête supplémentaire pour l'obtenir : `getLatestWaitTimesByPark`
   * fait déjà `include: { poi: true }`.
   */
  banner: string | null;
};
