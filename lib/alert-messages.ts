// Textes des alertes push, construits CÔTÉ SERVEUR par le moteur
// (/api/cron/alerts). Un petit dictionnaire autonome (pas de next-intl ici : un
// job de fond n'a pas de contexte de requête/locale) couvrant fr + en, avec repli
// sur l'anglais — même philosophie que le reste de l'app. Ajouter une langue = une
// entrée de plus.

type AlertStrings = {
  // Corps : « {ride} est à {wait} min (≤ {threshold} min) ». Le parc est ajouté
  // comme contexte discret.
  body: (p: {
    ride: string;
    wait: number;
    threshold: number;
    park: string;
  }) => string;
};

const DICT: Record<string, AlertStrings> = {
  fr: {
    body: ({ ride, wait, threshold, park }) =>
      `${ride} est à ${wait} min (seuil ${threshold} min) · ${park}`,
  },
  en: {
    body: ({ ride, wait, threshold, park }) =>
      `${ride} is at ${wait} min (threshold ${threshold} min) · ${park}`,
  },
};

const TITLE: Record<string, string> = {
  fr: "Temps d'attente descendu",
  en: "Wait time dropped",
};

export function buildAlertMessage(
  locale: string | null | undefined,
  data: { ride: string; wait: number; threshold: number; park: string },
): { title: string; body: string } {
  const lang = locale && DICT[locale] ? locale : "en";
  return {
    title: TITLE[lang],
    body: DICT[lang].body(data),
  };
}
