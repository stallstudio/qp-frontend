import { proxiedImageUrl } from "@/lib/image-proxy";

/**
 * La bannière que la source du parc publie pour un POI, quand elle en publie
 * une. Vaut pour les ATTRACTIONS COMME POUR LES SPECTACLES : les deux sont des
 * lignes `poi`, avec le même `additionalData`.
 *
 * ⚠️ **`additionalData` est un `Json` libre, écrit par le worker** : sa forme
 * n'est garantie par aucun type. On la sonde donc au lieu de la caster — une
 * source qui changerait de structure ne doit pas faire tomber la page d'un parc
 * pour une image.
 *
 * ⚠️ **L'URL rendue n'est PAS celle du parc**, mais un chemin local signé :
 * `proxiedImageUrl` la fait passer par notre domaine. Sans quoi il faudrait
 * déclarer l'hôte de chaque parc dans `next.config.ts` — une liste qui se
 * périme au premier parc suivant. Voir `lib/image-proxy.ts`.
 *
 * ⚠️ **À n'appeler que côté serveur** : `proxiedImageUrl` signe, et la clé
 * n'existe pas dans le navigateur.
 */
export function readBanner(value: unknown): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const banner = (value as Record<string, unknown>).banner;
  if (typeof banner !== "string") return null;
  return proxiedImageUrl(banner);
}

/**
 * La CARTE (menu) d'un POI, lue dans le même `additionalData` que la bannière.
 *
 * ⚠️ **Pas de proxy, contrairement à `readBanner`.** `proxiedImageUrl` signe des
 * IMAGES pour qu'elles traversent `next/image` sans que l'hôte de chaque parc
 * soit déclaré dans `next.config.ts` ; un menu est presque toujours un PDF,
 * ouvert dans un nouvel onglet sur le site du parc. Le faire passer par le proxy
 * d'images le rendrait illisible.
 *
 * ⚠️ Sondé et non casté, comme `readBanner` : `additionalData` est un `Json`
 * libre, sa forme n'est garantie par aucun type.
 */
export function readPoiMenu(value: unknown): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const menu = (value as Record<string, unknown>).menu;
  return typeof menu === "string" && menu ? menu : null;
}

/**
 * La ZONE du parc où se trouve le POI — « Fantasyland », « Dock World » —, lue
 * dans le même `additionalData` que la bannière.
 *
 * ⚠️ **Le texte est celui de la SOURCE, dans SA langue** : « Zoetigheden » chez
 * Bellewaerde, « アムステルダムシティ » chez Huis Ten Bosch. Rien ne le traduit,
 * et rien ne le pourra — c'est un nom propre de quartier, pas un libellé
 * d'interface. C'est ce qui avait fait retirer le bloc « Informations » du popup
 * des restaurants (voir `poi-detail-dialog.tsx`) ; affiché SEUL sous le nom
 * d'une attraction, en revanche, il répond à la seule question qu'on se pose
 * devant une fiche : c'est où dans le parc ?
 *
 * ⚠️ Sondé et non casté, comme `readBanner` : `additionalData` est un `Json`
 * libre, sa forme n'est garantie par aucun type. Le nettoyage est commun avec
 * `readPoiVenue`, voir `readLieu`.
 */
export function readPoiZone(value: unknown): string | null {
  return readLieu(value, "zone");
}

/**
 * La SALLE où se joue un spectacle — « Amfiteatr Colosseo », « Teatr Egypt ».
 *
 * ⚠️ **Ce n'est PAS un repli de `readPoiZone` ici, c'en est un chez l'appelant** :
 * les deux clés disent des choses différentes — le quartier du parc d'un côté,
 * le lieu de la représentation de l'autre. C'est le popup du spectacle qui
 * décide de montrer la seconde à défaut de la première, parce que la question
 * posée est la même : c'est où ?
 *
 * ⚠️ Rare et concentrée : 134 spectacles sur 6 488 en ont une (mesuré le
 * 2026-09-02), dont 109 SANS quartier — Energylandia, Movie Park Germany et
 * Flamingo Land nomment la salle et rien d'autre. C'est exactement là que le
 * repli sert.
 */
export function readPoiVenue(value: unknown): string | null {
  return readLieu(value, "venue");
}

/**
 * Le nettoyage commun aux deux lieux ci-dessus.
 *
 * ⚠️ **Deux formes sont écartées, mesurées en production le 2026-09-02** : les
 * codes purement numériques (Everland, Caribbean Bay et Universal Studios
 * Beijing numérotent leurs zones « 01 », « 3 »…) et les slugs tout en minuscules
 * (`efteling-park`). 205 POI sur 5 172 zonés — le reste est du texte lisible.
 * Un lieu illisible sous le titre est pire que pas de lieu du tout, et c'est
 * exactement ce que demande l'appelant : le lieu si on le connaît, rien sinon.
 */
function readLieu(value: unknown, cle: "zone" | "venue"): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const brut = (value as Record<string, unknown>)[cle];
  if (typeof brut !== "string") return null;
  const trimmed = brut.trim();
  if (!trimmed) return null;
  // Un code interne (« 01 », « 666 ») ne dit rien à personne.
  if (/^\d+$/.test(trimmed)) return null;
  // Un slug (`efteling-park`) : tout en minuscules, mots liés par des tirets.
  // Un vrai nom de lieu porte une majuscule ou un espace, et n'est pas touché.
  if (/^[a-z0-9]+(?:-[a-z0-9]+)+$/.test(trimmed)) return null;
  return trimmed;
}
