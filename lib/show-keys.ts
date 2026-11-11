import type { ShowTime } from "@/types/show";

// ————————————————————————————————————————————————————————————————————————
// LA CLÉ D'UN SPECTACLE
//
// Favoris (`{parc}:{nom}`, namespace `shows`) et rappels (`showName` en base
// utilisateurs) désignent un spectacle par son NOM — il n'en a pas d'autre
// identifiant stable côté Queue Park. Or depuis le 2026-11-11, `showName` est
// TRADUIT par l'API dans la langue de la page : s'en servir comme clé ferait
// qu'un favori posé en français disparaisse en anglais.
//
// La clé est donc `showKey` : le nom PRINCIPAL du spectacle, le même dans
// toutes les langues (`pois.name`). `showName` ne sert plus qu'à l'affichage.
// ————————————————————————————————————————————————————————————————————————

type KeyedShow = Pick<ShowTime, "showName" | "showKey" | "showKeyAliases">;

/**
 * Le nom qui sert de clé : `showKey`, ou `showName` sur une réponse qui n'en
 * porte pas (une API d'avant la traduction, où les deux se confondaient).
 */
export function showKeyOf(show: KeyedShow): string {
  return show.showKey ?? show.showName;
}

/**
 * Toutes les clés de favori sous lesquelles ce spectacle a pu être enregistré
 * — la principale d'abord.
 *
 * ⚠️ **Les autres noms comptent aussi** (`showKeyAliases`) : un favori posé
 * quand le nom principal du parc était dans une autre langue en porte un. Les
 * spectacles d'Europa-Park et de Rulantica s'appelaient en anglais jusqu'au
 * 2026-11-11, en allemand depuis ; leurs favoris d'avant sont restés tels
 * quels, en localStorage comme en compte.
 */
export function showFavKeys(parkIdentifier: string, show: KeyedShow): string[] {
  return [showKeyOf(show), ...(show.showKeyAliases ?? [])].map(
    (name) => `${parkIdentifier}:${name}`,
  );
}

/**
 * La clé à donner au bouton favori : celle sous laquelle le spectacle est DÉJÀ
 * favori — pour que le retirer retire bien cette entrée-là —, la principale
 * sinon. Un nouveau favori s'enregistre donc toujours sous la clé principale.
 */
export function showFavKey(
  parkIdentifier: string,
  show: KeyedShow,
  isFavorite: (key: string) => boolean,
): string {
  const keys = showFavKeys(parkIdentifier, show);
  return keys.find(isFavorite) ?? keys[0];
}
