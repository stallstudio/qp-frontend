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

// ⚠️ Les RÉPONSES de résolution ne vivent PAS ici. Elles appartiennent à
// l'admin (table `report_templates`, éditable depuis /report-templates) et le
// frontend n'en a jamais lu une seule ligne : ce fichier n'en gardait qu'une
// copie morte, vouée à diverger du texte réellement envoyé aux utilisateurs.
// Seules les CATÉGORIES ci-dessous sont partagées — elles servent au formulaire
// public et à la notification Discord de `app/api/report/route.ts`.
//
// ⚠️ **Les motifs, eux, restent DÉLIBÉRÉMENT dans le code.** Ce n'est pas du
// texte éditorial mais une STRUCTURE : les `id` sont écrits tels quels dans
// `reports.category` / `reports.subcategory`, alimentent les filtres de l'admin,
// et doivent être connus du frontend pour construire le formulaire. Les mettre
// en base les rendrait modifiables sans redéploiement — un motif ajouté ne
// s'afficherait alors nulle part, et l'admin filtrerait sur une catégorie que
// personne ne peut choisir. La copie de l'admin (`lib/report-config.ts`) doit
// donc rester alignée sur celle-ci ; en cas d'écart, l'admin retombe sur
// l'identifiant brut plutôt que de casser.
//
// ⚠️ **Limite connue : ces libellés n'existent qu'en `fr` et `en`** alors que le
// site parle 14 langues. `getLocalizedString()` de `report-problem-dialog.tsx`
// retombe sur l'anglais : un visiteur japonais lit donc un formulaire en
// japonais (`messages/ja.json` traduit bien `categoryLabel`,
// `categoryPlaceholder`…) dont la LISTE DÉROULANTE est en anglais. Le correctif
// n'est pas de déplacer ces motifs en base — ce serait 14 colonnes ou une table
// de traductions — mais de les passer à next-intl, dont le merge
// `{ ...en, ...locale }` (voir `i18n/request.ts`) fournit déjà le repli EN.

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

export function getCategoryColor(categoryId: string): string {
  const category = PROBLEM_CATEGORIES.find((cat) => cat.id === categoryId);
  return (
    category?.color ||
    "bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-300"
  );
}
