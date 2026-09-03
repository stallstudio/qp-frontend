// ————————————————————————————————————————————————————————————————————————
// ANNONCE DE VERSION
//
// Une seule et même mécanique pour toutes les annonces à venir : la clé de
// stockage embarque le NUMÉRO DE VERSION, donc annoncer la v4 se résume à
// changer `WHATS_NEW_VERSION` — les visiteurs qui avaient fermé l'annonce v3
// reverront la nouvelle, sans qu'on ait à nettoyer quoi que ce soit.
//
// ⚠️ La v2 stockait `welcome-v2-seen`. Cette clé-là n'est PAS relue : un
// visiteur de l'époque doit voir l'annonce v3, c'est tout l'objet du versionnage.
// ————————————————————————————————————————————————————————————————————————

export const WHATS_NEW_VERSION = "3";

export const WHATS_NEW_STORAGE_KEY = `qp-whats-new-v${WHATS_NEW_VERSION}-seen`;

// Garde-fou : passé cette date, l'annonce ne s'affiche plus pour personne, même
// pour un visiteur qui n'était pas revenu depuis. Annoncer « la nouvelle
// version » un an après sa sortie ne rend service à personne, et évite qu'un
// oubli de nettoyage se voie en production. Même principe que la v2.
export const WHATS_NEW_EXPIRES_AT = "2027-03-01";

export function isWhatsNewExpired(now: Date = new Date()): boolean {
  return now >= new Date(WHATS_NEW_EXPIRES_AT);
}

/**
 * L'annonce a-t-elle déjà été vue (ou écartée) sur cet appareil ?
 *
 * En navigation privée / stockage bloqué, `localStorage` lève : on renvoie
 * alors `true` (ne pas afficher) plutôt que de rouvrir l'annonce à chaque
 * navigation, ce qui serait bien plus pénible qu'une annonce manquée.
 */
export function hasSeenWhatsNew(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(WHATS_NEW_STORAGE_KEY) !== null;
  } catch {
    return true;
  }
}

export function markWhatsNewSeen(): void {
  try {
    window.localStorage.setItem(WHATS_NEW_STORAGE_KEY, new Date().toISOString());
  } catch {
    // Stockage indisponible : l'annonce se refermera quand même pour la session
    // en cours (l'état React), elle reviendra au prochain chargement.
  }
}
