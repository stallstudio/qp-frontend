// Textes des RAPPELS DE SPECTACLES push, construits côté serveur par le moteur
// (/api/cron/alerts). Même philosophie que lib/alert-messages.ts : petit
// dictionnaire autonome fr + en, repli sur l'anglais.
//
// Ton : la personne est déjà (ou bientôt) dans le parc. Titre court + emoji ;
// corps factuel (spectacle, heure du créneau, délai). `timeLabel` est déjà formaté
// par l'appelant (fuseau du parc + format 12/24 h de l'utilisateur).

export type ReminderShow = { show: string; timeLabel: string; lead: number };

type ReminderStrings = {
  singleTitles: string[];
  digestTitle: (count: number) => string;
  singleBody: (p: ReminderShow) => string;
  digestLine: (p: ReminderShow) => string;
  more: (n: number) => string;
};

const DICT: Record<string, ReminderStrings> = {
  fr: {
    singleTitles: [
      "Le spectacle va commencer ! 🎭",
      "C'est bientôt l'heure 🎪",
      "Ne manquez pas la représentation 👀",
      "Rendez-vous au spectacle ✨",
    ],
    digestTitle: (count) => `🎭 ${count} spectacles approchent !`,
    singleBody: ({ show, timeLabel, lead }) =>
      `${show} commence à ${timeLabel} (dans ${lead} min).`,
    digestLine: ({ show, timeLabel }) => `• ${show} — ${timeLabel}`,
    more: (n) => `+ ${n} autre${n > 1 ? "s" : ""}`,
  },
  en: {
    singleTitles: [
      "The show's about to start! 🎭",
      "Showtime is near 🎪",
      "Don't miss the performance 👀",
      "Head to the show ✨",
    ],
    digestTitle: (count) => `🎭 ${count} shows starting soon!`,
    singleBody: ({ show, timeLabel, lead }) =>
      `${show} starts at ${timeLabel} (in ${lead} min).`,
    digestLine: ({ show, timeLabel }) => `• ${show} — ${timeLabel}`,
    more: (n) => `+ ${n} more`,
  },
};

const DIGEST_MAX_LINES = 3;

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Construit le message push pour UN utilisateur, à partir du ou des rappels qui
// arrivent à échéance dans ce passage du moteur.
export function buildShowReminderMessage(
  locale: string | null | undefined,
  shows: ReminderShow[],
): { title: string; body: string } {
  const lang = locale && DICT[locale] ? locale : "en";
  const d = DICT[lang];

  if (shows.length === 1) {
    return { title: pick(d.singleTitles), body: d.singleBody(shows[0]) };
  }

  const shown = shows.slice(0, DIGEST_MAX_LINES);
  const lines = shown.map((s) => d.digestLine(s));
  const rest = shows.length - shown.length;
  if (rest > 0) lines.push(d.more(rest));

  return { title: d.digestTitle(shows.length), body: lines.join("\n") };
}
