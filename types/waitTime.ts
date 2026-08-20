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
};
