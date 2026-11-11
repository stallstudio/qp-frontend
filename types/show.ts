import type { PoiPrice } from "@/lib/poi-facts";

export interface ShowSchedule {
  startTime: string;
  endTime?: string | null;
}

export interface ShowTime {
  /**
   * Le POI du spectacle. Sert à reconnaître, parmi les spectacles d'un
   * événement, ceux qui n'ont AUCUNE séance aujourd'hui (voir
   * `lib/event-pois.ts` de l'API Dispatch).
   */
  poiId: number;
  /**
   * Le nom À AFFICHER, dans la langue de la page quand la source du parc la
   * publie (l'API traduit sur `?locale=`).
   *
   * ⚠️ **Ce n'est pas une clé** : favoris et rappels passent par `showKey`
   * (voir `lib/show-keys.ts`).
   */
  showName: string;
  /**
   * Le nom PRINCIPAL du spectacle, le même dans toutes les langues : la clé
   * des favoris (`{parc}:{showKey}`) et des rappels. Posé par l'API Dispatch
   * sur toute réponse live depuis le 2026-11-11.
   */
  showKey?: string;
  /**
   * Les noms du spectacle dans les autres langues que publie sa source : un
   * favori posé sous l'un d'eux se retrouve (voir `showFavKeys`).
   */
  showKeyAliases?: string[];
  duration: number;
  schedules: ShowSchedule[];
  /**
   * Événement saisonnier dont ce spectacle fait partie. `null` pour la
   * quasi-totalité de la programmation.
   *
   * ⚠️ Même règle que `WaitTime.eventId` : un spectacle tagué n'apparaît QUE
   * dans la carte de son événement, jamais dans la timeline principale.
   *
   * ⚠️ La raison est ici plus dure qu'un simple choix de rangement : mélanger
   * des représentations nocturnes dans la timeline du jour ÉTIRE L'AXE de ~10 h
   * à ~15 h d'amplitude et écrase toutes les représentations de journée. Deux
   * grilles, deux axes.
   */
  eventId: number | null;
  /**
   * Bannière publiée par la source du parc pour ce spectacle, sous forme de
   * chemin LOCAL signé (voir `lib/poi-banner.ts` de l'API Dispatch), ou `null` quand la source
   * n'en publie pas — le popup retombe alors sur l'image par défaut.
   */
  banner: string | null;
  /**
   * Zone du parc où se joue le spectacle — « Fantasyland », « Dock World » —,
   * telle que la source la nomme, ou `null` quand elle n'en publie pas.
   *
   * ⚠️ **Dans la langue de la SOURCE, et pas traduisible** : c'est un nom propre
   * de quartier. Voir `readPoiZone`, qui écarte au passage les codes internes.
   *
   * ⚠️ Distincte de la SALLE (`venue`, juste en dessous), qui prend le relais
   * quand la source ne publie pas de quartier.
   */
  zone: string | null;
  /**
   * Salle où se joue le spectacle — « Amfiteatr Colosseo », « Teatr Egypt ».
   *
   * ⚠️ **Le popup ne l'affiche QU'À DÉFAUT de `zone`**, au même endroit : les
   * deux répondent à « c'est où ? », mais le quartier situe dans le parc quand
   * la salle ne situe que dans le quartier. Les montrer ensemble ferait deux
   * lignes pour une question.
   *
   * ⚠️ Rare (134 spectacles sur 6 488), mais presque toujours SEULE quand elle
   * est là : 109 de ces spectacles n'ont pas de quartier. Energylandia, Movie
   * Park Germany et Flamingo Land nomment la salle et rien d'autre.
   */
  venue: string | null;
  /**
   * Niveau de peur d'une maison hantée, de 1 à 5, et son prix d'accès en plus
   * de l'entrée — `null` quand la source n'en publie pas, c'est-à-dire presque
   * partout. Voir `lib/poi-facts.ts`.
   */
  fearLevel: number | null;
  price: PoiPrice | null;
}
