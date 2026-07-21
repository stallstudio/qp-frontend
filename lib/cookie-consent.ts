// Consentement aux cookies de mesure d'audience (Google Analytics). Les cookies
// strictement nécessaires (session d'authentification, préférence de langue) ne
// sont PAS concernés. Stocké en localStorage ; un événement custom permet aux
// composants (bandeau, chargeur GA) de réagir au choix sans rechargement.

export const CONSENT_KEY = "qp-cookie-consent";
export type ConsentValue = "granted" | "denied";

// Émis quand l'utilisateur fait/retire un choix (detail = ConsentValue).
export const CONSENT_EVENT = "qp-consent-change";
// Émis par le lien « Gérer les cookies » du footer pour rouvrir le bandeau.
export const OPEN_CONSENT_EVENT = "qp-open-cookie-settings";

export function readConsent(): ConsentValue | null {
  if (typeof window === "undefined") return null;
  try {
    const v = window.localStorage.getItem(CONSENT_KEY);
    return v === "granted" || v === "denied" ? v : null;
  } catch {
    return null;
  }
}

export function setConsent(value: ConsentValue): void {
  try {
    window.localStorage.setItem(CONSENT_KEY, value);
  } catch {
    // localStorage indisponible (mode privé) : le choix reste en mémoire via l'évènement.
  }
  window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: value }));
}

export function openCookieSettings(): void {
  window.dispatchEvent(new CustomEvent(OPEN_CONSENT_EVENT));
}
