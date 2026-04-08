type LocalizedString = {
  [locale: string]: string;
};

type ProblemCategory = {
  id: string;
  label: LocalizedString;
  color: string;
  subcategories: {
    id: string;
    label: LocalizedString;
    alert?: LocalizedString;
  }[];
};

type ResolutionOption = {
  value: string;
  label: LocalizedString;
  message: LocalizedString;
  color: string;
};

export const PROBLEM_CATEGORIES: ProblemCategory[] = [
  {
    id: "wait-time",
    label: {
      fr: "Temps d'attente",
      en: "Wait Time",
    },
    color: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
    subcategories: [
      {
        id: "incorrect-wait-time",
        label: {
          fr: "Temps d'attente incorrect pour une ou plusieurs attractions",
          en: "Incorrect wait time for one or more attractions",
        },
        alert: {
          fr: "Nos données proviennent directement de l'application officielle du parc. Ne signalez ce problème que si les temps d'attente diffèrent entre Queue Park et l'application du parc.",
          en: "Our data comes directly from the park's official app. Only report this issue if wait times differ between Queue Park and the park's app.",
        },
      },
      {
        id: "incorrect-status",
        label: {
          fr: "Statut incorrect pour une ou plusieurs attractions",
          en: "Incorrect status for one or more attractions",
        },
        alert: {
          fr: "Nos données proviennent directement de l'application officielle du parc. Ne signalez ce problème que si le statut d'une attraction diffère entre Queue Park et l'application du parc.",
          en: "Our data comes directly from the park's official app. Only report this issue if an attraction's status differs between Queue Park and the park's app.",
        },
      },
      {
        id: "missing-attractions",
        label: {
          fr: "Une ou plusieurs attractions manquantes",
          en: "One or more missing attractions",
        },
      },
      {
        id: "not-updating",
        label: {
          fr: "Les temps d'attente ne se mettent pas à jour",
          en: "Wait times are not updating",
        },
      },
      {
        id: "other",
        label: {
          fr: "Autre",
          en: "Other",
        },
      },
    ],
  },
  {
    id: "shows",
    label: {
      fr: "Spectacles",
      en: "Shows",
    },
    color:
      "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
    subcategories: [
      {
        id: "missing-shows",
        label: {
          fr: "Spectacles manquants dans la programmation du jour",
          en: "Missing shows in today's schedule",
        },
        alert: {
          fr: "Nos données proviennent directement de l'application officielle du parc. Ne signalez ce problème que si un spectacle est présent dans l'application du parc mais absent de Queue Park.",
          en: "Our data comes directly from the park's official app. Only report this issue if a show appears in the park's app but is missing from Queue Park.",
        },
      },
      {
        id: "missing-showtimes",
        label: {
          fr: "Créneaux horaires manquants pour un spectacle",
          en: "Missing showtimes for a show",
        },
        alert: {
          fr: "Nos données proviennent directement de l'application officielle du parc. Ne signalez ce problème que si des horaires sont présents dans l'application du parc mais absents de Queue Park.",
          en: "Our data comes directly from the park's official app. Only report this issue if showtimes appear in the park's app but are missing from Queue Park.",
        },
      },
      {
        id: "incorrect-duration",
        label: {
          fr: "Durée incorrecte d'un spectacle",
          en: "Incorrect duration of a show",
        },
      },
      {
        id: "other",
        label: {
          fr: "Autre",
          en: "Other",
        },
      },
    ],
  },
  {
    id: "schedules",
    label: {
      fr: "Horaires d'ouverture",
      en: "Opening Hours",
    },
    color:
      "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
    subcategories: [
      {
        id: "park-closed-but-open",
        label: {
          fr: "Le parc apparaît comme fermé alors qu'il est ouvert",
          en: "Park appears as closed when it is open",
        },
      },
      {
        id: "incorrect-hours",
        label: {
          fr: "Horaires du jour incorrects",
          en: "Incorrect hours for today",
        },
      },
      {
        id: "incorrect-timezone",
        label: {
          fr: "Heure locale incorrecte",
          en: "Incorrect local time",
        },
      },
      {
        id: "missing-special-hours",
        label: {
          fr: "Horaires spéciaux manquants (accès anticipé, extension, etc.)",
          en: "Missing special hours (early access, extended hours, etc.)",
        },
      },
      {
        id: "other",
        label: {
          fr: "Autre",
          en: "Other",
        },
      },
    ],
  },
  {
    id: "other",
    label: {
      fr: "Autres",
      en: "Other",
    },
    color: "bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-300",
    subcategories: [
      {
        id: "global-issue",
        label: {
          fr: "Problème global",
          en: "Global issue",
        },
      },
      {
        id: "display-issue",
        label: {
          fr: "Problème d'affichage",
          en: "Display issue",
        },
      },
      {
        id: "incorrect-data",
        label: {
          fr: "Données erronées",
          en: "Incorrect data",
        },
      },
      {
        id: "specific-request",
        label: {
          fr: "Demande spécifique",
          en: "Specific request",
        },
      },
      {
        id: "other",
        label: {
          fr: "Autre",
          en: "Other",
        },
      },
    ],
  },
];

export const RESOLUTION_OPTIONS: ResolutionOption[] = [
  {
    value: "not-enough-info",
    label: {
      fr: "Pas assez d'informations",
      en: "Insufficient information",
    },
    message: {
      fr: "Nous n'avons pas pu traiter votre signalement car les informations fournies étaient insuffisantes. N'hésitez pas à soumettre un nouveau signalement avec plus de détails.",
      en: "We were unable to process your report due to insufficient information. Feel free to submit a new report with more details.",
    },
    color:
      "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
  },
  {
    value: "fixed",
    label: {
      fr: "Problème résolu",
      en: "Issue fixed",
    },
    message: {
      fr: "Le problème que vous avez signalé a été corrigé. Merci de nous avoir aidés à améliorer Queue Park !",
      en: "The issue you reported has been fixed. Thank you for helping us improve Queue Park!",
    },
    color: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  },
  {
    value: "not-our-side",
    label: {
      fr: "Problème externe",
      en: "External issue",
    },
    message: {
      fr: "Après vérification, le problème signalé ne provient pas de nos données. Il peut s'agir d'une information directement fournie par le parc.",
      en: "After investigation, the reported issue does not originate from our data. It may be information provided directly by the park.",
    },
    color: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  },
  {
    value: "duplicate",
    label: {
      fr: "Doublon",
      en: "Duplicate",
    },
    message: {
      fr: "Votre signalement a déjà été pris en compte via un autre report. Merci pour votre vigilance !",
      en: "Your report has already been addressed through another report. Thank you for your vigilance!",
    },
    color: "bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-300",
  },
  {
    value: "wont-fix",
    label: {
      fr: "Ne sera pas corrigé",
      en: "Won't fix",
    },
    message: {
      fr: "Après analyse, nous avons décidé de ne pas donner suite à ce signalement. Merci de votre compréhension.",
      en: "After review, we have decided not to act on this report. Thank you for your understanding.",
    },
    color: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  },
];

export function getCategoryLabel(categoryId: string, locale = "en"): string {
  const category = PROBLEM_CATEGORIES.find((cat) => cat.id === categoryId);
  return category?.label[locale] || category?.label.en || categoryId;
}

export function getSubcategoryLabel(
  categoryId: string,
  subcategoryId: string,
  locale = "en",
): string {
  const category = PROBLEM_CATEGORIES.find((cat) => cat.id === categoryId);
  const subcategory = category?.subcategories.find(
    (sub) => sub.id === subcategoryId,
  );
  return subcategory?.label[locale] || subcategory?.label.en || subcategoryId;
}

export function getResolutionLabel(
  resolutionValue: string,
  locale = "en",
): string {
  const resolution = RESOLUTION_OPTIONS.find(
    (res) => res.value === resolutionValue,
  );
  return resolution?.label[locale] || resolution?.label.en || resolutionValue;
}

export function getResolutionMessage(
  resolutionValue: string,
  locale = "en",
): string {
  const resolution = RESOLUTION_OPTIONS.find(
    (res) => res.value === resolutionValue,
  );
  return resolution?.message[locale] || resolution?.message.en || "";
}

export function getCategoryColor(categoryId: string): string {
  const category = PROBLEM_CATEGORIES.find((cat) => cat.id === categoryId);
  return (
    category?.color ||
    "bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-300"
  );
}

export function getResolutionColor(resolutionValue: string): string {
  const resolution = RESOLUTION_OPTIONS.find(
    (res) => res.value === resolutionValue,
  );
  return (
    resolution?.color ||
    "bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-300"
  );
}
