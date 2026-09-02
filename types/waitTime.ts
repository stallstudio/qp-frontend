import type { PoiKind } from "@/lib/poi-kinds";

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
  /**
   * Famille du POI — `"ride"` pour la quasi-totalité des lignes.
   *
   * ⚠️ **`wait_times` n'est plus la table des seules attractions** (2026-08-28) :
   * certaines sources y publient l'état de leurs restaurants, boutiques ou
   * services, sous le même espace d'identifiants. Sans ce champ, ils se
   * verseraient dans la carte « Attractions » — un snack au milieu des coasters.
   *
   * ⚠️ `"ride"` quand la valeur en base est illisible : mieux vaut une entité mal
   * rangée qu'une entité qui disparaît de la page.
   */
  kind: PoiKind;

  /**
   * Zone du parc où se trouve le POI — « Fantasyland », « Dock World » —, telle
   * que la source la nomme. `null` quand elle n'en publie pas : un parc zoné sur
   * deux environ (mesuré le 2026-09-02).
   *
   * ⚠️ **Dans la langue de la SOURCE, et pas traduisible** : c'est un nom propre
   * de quartier. Voir `readPoiZone`, qui écarte au passage les codes internes.
   *
   * ⚠️ Aucune requête supplémentaire pour l'obtenir : `getLatestWaitTimesByPark`
   * fait déjà `include: { poi: true }`.
   */
  zone: string | null;
  /**
   * Carte du restaurant publiée par la source, en URL ABSOLUE — souvent un PDF
   * sur le site du parc.
   *
   * ⚠️ **`null` sur toute attraction, à dessein**, et pas seulement parce que
   * leur popup ne l'afficherait pas : un gros parc en aligne deux cents, et
   * cette charge utile repart à chaque rafraîchissement de 60 s.
   *
   * ⚠️ **Ce n'est PAS une image** : contrairement à `banner`, elle ne passe pas
   * par `proxiedImageUrl`. Le proxy sert à faire traverser `next/image` sans
   * déclarer l'hôte de chaque parc ; un PDF n'y a rien à faire.
   */
  menu: string | null;
};
