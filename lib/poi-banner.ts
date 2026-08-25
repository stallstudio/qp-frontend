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
