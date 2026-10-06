import { useSyncExternalStore } from "react";

const TICK_MS = 15_000;

function subscribe(onChange: () => void) {
  const id = setInterval(onChange, TICK_MS);
  return () => clearInterval(id);
}

// Arrondi à la minute : la valeur ne change qu'une fois par minute, donc React
// ne re-rend qu'à ce moment-là, même si l'abonnement réveille plus souvent.
const getSnapshot = () => Math.floor(Date.now() / 60_000) * 60_000;

// ⚠️ `null` côté serveur ET pendant l'hydratation : l'heure de Node et celle du
// navigateur diffèrent, et un ordre de liste calculé sur l'une puis sur l'autre
// casserait l'hydratation. React rend une première fois avec `null`, puis
// aussitôt avec l'heure réelle. Monté côté client seulement (onglet ouvert
// après coup), le composant a l'heure dès son premier rendu.
const getServerSnapshot = () => null;

/** L'instant présent (ms), arrondi à la minute ; `null` tant qu'on hydrate. */
export function useMinuteClock(): number | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
