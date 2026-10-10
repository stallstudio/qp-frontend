import { proxiedImageUrl } from "@/lib/image-proxy";

// ————————————————————————————————————————————————————————————————————————
// LES VRAIES IMAGES DE L'ANNONCE DE VERSION
//
// Les scènes de `scenes.tsx` rendent les vrais composants de la page d'un parc,
// popups compris : un popup montre la bannière que la SOURCE publie pour son
// POI. Ce sont donc ces bannières-là, et pas la photo de repli de Queue Park.
//
// ⚠️ **Ce module est SERVEUR, et il doit le rester** : `proxiedImageUrl` signe
// avec une clé dérivée d'`AUTH_SECRET`, absente du navigateur. Les scènes, elles,
// sont des composants client : elles reçoivent le résultat par le contexte de
// `scene-frame.tsx`, elles ne l'appellent jamais.
//
// ⚠️ **La signature est calculée à CHAQUE RENDU, jamais recopiée en dur dans le
// JSX.** Une URL `/api/image?u=…&s=…` collée dans le code est valable pour un
// seul `AUTH_SECRET` : le jour où celui de la production diffère de celui du
// poste qui l'a produite — ou à la première rotation de secret —, l'image est
// rejetée par `/api/image` et disparaît SANS ERREUR VISIBLE. Ici, elle suit le
// secret de l'environnement qui rend la page.
// ————————————————————————————————————————————————————————————————————————

// Les bannières telles que les sources les publient, relevées le 2026-10-10
// dans `/api/park/{parc}` (voir `demo-data.ts`).
const SOURCES = {
  bigThunder:
    "https://media.disneylandparis.com/d4th/en-gb/images/n017798_2050jan01_big-thunder-mountain_16-9_tcm752-159546.jpg?fit=max&w=1600",
  hyperspace:
    "https://media.disneylandparis.com/d4th/en-gb/images/hd13578_2022jun29_world_star-wars-hyperspace-mountain_16-9_tcm752-162410.jpg?fit=max&w=1600",
  slaughterhouse:
    "https://www.walibi.nl/content/dam/who/images/events/hfn/2025/HFN_Walibi_Slaughterhouse_1.jpg",
} as const;

export type WhatsNewBanners = Record<keyof typeof SOURCES, string | null>;

/**
 * Les images de l'annonce, prêtes à être rendues : chemins locaux signés.
 *
 * ⚠️ **`null` sur échec, et non une exception** : `proxiedImageUrl` LÈVE quand
 * `AUTH_SECRET` manque, et ce module est appelé depuis le layout — c'est-à-dire
 * sur toutes les pages du site. Sans ce garde-fou, un `.env` incomplet ne ferait
 * pas disparaître une vignette d'annonce : il ferait tomber le site entier. Un
 * `null` donne la photo de repli, exactement comme un popup sans bannière.
 */
export function whatsNewBanners(): WhatsNewBanners {
  const sign = (url: string): string | null => {
    try {
      return proxiedImageUrl(url) ?? null;
    } catch {
      // AUTH_SECRET absent : l'annonce garde la photo de repli, le site vit.
      return null;
    }
  };
  return {
    bigThunder: sign(SOURCES.bigThunder),
    hyperspace: sign(SOURCES.hyperspace),
    slaughterhouse: sign(SOURCES.slaughterhouse),
  };
}
