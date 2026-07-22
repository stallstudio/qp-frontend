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
  // Note ajoutée en bas du corps : l'alerte est désactivée (objectif atteint),
  // réactivable depuis le profil. Pluriel pour le digest.
  deactivatedNote: (count: number) => string;
};

const DICT: Record<string, AlertStrings> = {
  fr: {
    singleTitles: [
      "Tu peux foncer 🏃",
      "À toi ! 🎯",
      "C'est le moment ! 🎢",
      "À toi de jouer ! 🚀",
      "File vite ! 🏃",
      "Go, go, go ! ⚡",
      "Bonne nouvelle ! 🎉",
      "L'attente baisse 📉",
    ],
    digestTitle: (count) => `🎢 ${count} temps d'attente en baisse !`,
    singleBody: ({ ride, wait, threshold }) =>
      `${ride} est à ${wait} min (🎯 ≤ ${threshold} min)`,
    digestLine: ({ ride, wait }) => `• ${ride} — ${wait} min`,
    more: (n) => `+ ${n} autre${n > 1 ? "s" : ""}`,
    deactivatedNote: (count) =>
      count > 1
        ? "💡 Alertes en pause — réactive-les dans ton profil."
        : "💡 Alerte en pause — réactive-la dans ton profil.",
  },
  en: {
    singleTitles: [
      "Run for it! 🏃",
      "Your turn! 🎯",
      "It's time! 🎢",
      "Your move! 🚀",
      "Hurry up! 🏃",
      "Go, go, go! ⚡",
      "Great news! 🎉",
      "Wait time is down 📉",
    ],
    digestTitle: (count) => `🎢 ${count} wait times just dropped!`,
    singleBody: ({ ride, wait, threshold }) =>
      `${ride} is at ${wait} min (🎯 ≤ ${threshold} min)`,
    digestLine: ({ ride, wait }) => `• ${ride} — ${wait} min`,
    more: (n) => `+ ${n} more`,
    deactivatedNote: (count) =>
      count > 1
        ? "💡 Alerts paused — re-enable them in your profile."
        : "💡 Alert paused — re-enable it in your profile.",
  },
};

// Nombre de lignes détaillées avant de résumer le reste par « + N autres ».
const DIGEST_MAX_LINES = 3;

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
    return {
      title: pick(d.singleTitles),
      // On rappelle en bas que l'alerte est désactivée (objectif atteint).
      body: `${d.singleBody(rides[0])}\n\n${d.deactivatedNote(1)}`,
    };
  }

  // Plusieurs : on liste les plus courtes d'abord (les plus « urgentes »).
  const sorted = [...rides].sort((a, b) => a.wait - b.wait);
  const shown = sorted.slice(0, DIGEST_MAX_LINES);
  const lines = shown.map((r) => d.digestLine(r));
  const rest = sorted.length - shown.length;
  if (rest > 0) lines.push(d.more(rest));
  lines.push("", d.deactivatedNote(rides.length));

  return { title: d.digestTitle(rides.length), body: lines.join("\n") };
}
