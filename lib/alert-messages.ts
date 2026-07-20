// Textes des alertes push, construits CÔTÉ SERVEUR par le moteur
// (/api/cron/alerts). Un petit dictionnaire autonome (pas de next-intl ici : un
// job de fond n'a pas de contexte de requête/locale) couvrant fr + en, avec repli
// sur l'anglais — même philosophie que le reste de l'app. Ajouter une langue = une
// entrée de plus.
//
// Ton : la personne alertée est DÉJÀ dans le parc. On ne répète donc pas le nom
// du parc, et le nom de l'app (« Queue Park ») est déjà ajouté par l'OS à la fin
// du titre de la notif. On mise sur un titre court, convivial et VARIÉ (tirage
// aléatoire + emoji) pour ne pas être redondant d'une alerte à l'autre. Le corps
// reste factuel (attraction, temps, seuil).

export type AlertRide = { ride: string; wait: number; threshold: number };

type AlertStrings = {
  // Titres « une attraction » : tirés au hasard à chaque envoi. Emoji + phrase
  // courte qui donne envie d'y aller.
  singleTitles: string[];
  // Titre « plusieurs attractions se libèrent en même temps » (digest).
  digestTitle: (count: number) => string;
  // Corps « une attraction ».
  singleBody: (p: AlertRide) => string;
  // Une ligne de la liste du digest.
  digestLine: (p: AlertRide) => string;
  // Pied du digest quand la liste est tronquée.
  more: (n: number) => string;
};

const DICT: Record<string, AlertStrings> = {
  fr: {
    singleTitles: [
      "🎢 File courte, fonce !",
      "⚡ Ça se dégage !",
      "🏃 C'est le moment d'y aller",
      "🎉 L'attente vient de chuter",
      "👀 Une place se libère",
      "🔥 Temps d'attente au plancher",
      "✨ Vite, avant que ça remonte !",
    ],
    digestTitle: (count) => `🎢 ${count} attractions se libèrent !`,
    singleBody: ({ ride, wait, threshold }) =>
      `${ride} n'est plus qu'à ${wait} min (seuil ${threshold} min).`,
    digestLine: ({ ride, wait }) => `• ${ride} — ${wait} min`,
    more: (n) => `+ ${n} autre${n > 1 ? "s" : ""}`,
  },
  en: {
    singleTitles: [
      "🎢 Short queue, go for it!",
      "⚡ The line just dropped!",
      "🏃 Now's your chance",
      "🎉 The wait just plunged",
      "👀 A spot's opening up",
      "🔥 Queue's at rock bottom",
      "✨ Quick, before it climbs back!",
    ],
    digestTitle: (count) => `🎢 ${count} rides are clearing up!`,
    singleBody: ({ ride, wait, threshold }) =>
      `${ride} is down to ${wait} min (threshold ${threshold} min).`,
    digestLine: ({ ride, wait }) => `• ${ride} — ${wait} min`,
    more: (n) => `+ ${n} more`,
  },
};

// Nombre de lignes détaillées avant de résumer le reste par « + N autres ».
const DIGEST_MAX_LINES = 5;

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Construit le message push pour UN utilisateur, à partir de la ou des attractions
// qui viennent de descendre sous leur seuil dans ce même passage du moteur. Une
// seule attraction -> titre convivial aléatoire ; plusieurs -> un digest listé
// (on ne spamme pas une notif par attraction).
export function buildAlertMessage(
  locale: string | null | undefined,
  rides: AlertRide[],
): { title: string; body: string } {
  const lang = locale && DICT[locale] ? locale : "en";
  const d = DICT[lang];

  if (rides.length === 1) {
    return { title: pick(d.singleTitles), body: d.singleBody(rides[0]) };
  }

  // Plusieurs : on liste les plus courtes d'abord (les plus « urgentes »).
  const sorted = [...rides].sort((a, b) => a.wait - b.wait);
  const shown = sorted.slice(0, DIGEST_MAX_LINES);
  const lines = shown.map((r) => d.digestLine(r));
  const rest = sorted.length - shown.length;
  if (rest > 0) lines.push(d.more(rest));

  return { title: d.digestTitle(rides.length), body: lines.join("\n") };
}
