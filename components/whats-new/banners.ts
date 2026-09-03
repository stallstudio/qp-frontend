import { proxiedImageUrl } from "@/lib/image-proxy";

// ————————————————————————————————————————————————————————————————————————
// LES DEUX VRAIES IMAGES DE L'ANNONCE DE VERSION
//
// Les scènes de `scenes.tsx` MIMENT l'interface réelle. Deux d'entre elles
// portent une image : la fiche d'attraction (scène 5) et l'en-tête de parc de la
// météo (scène 7). Sur `default_cover.webp` — la photo de repli de Queue Park —
// elles montraient un écran que personne ne verra jamais : un en-tête de parc
// affiche la photo DU parc, une fiche d'attraction la bannière DE l'attraction.
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

/**
 * Taron, Phantasialand — telle que le parc la publie, et telle que la fiche de
 * l'attraction l'affiche dans l'application.
 *
 * ⚠️ Attraction choisie pour son QUARTIER autant que pour sa photo : la scène
 * montre « MYSTERY » sous le nom, et c'est exactement ce que la source publie
 * pour elle (`additionalData.zone`). Une démo ne doit pas montrer un écran que
 * l'application ne produit pas — voir le commentaire de `DetailScene`.
 */
const RIDE_BANNER =
  "https://live-phlsys.s3.amazonaws.com/0c354b6fcc62400c74c9b7ed98a5c089.jpg";

/**
 * Cedar Point, telle que la page du parc l'affiche.
 *
 * ⚠️ **Pas de proxy ici, à dessein** : les covers de parcs sont servies par
 * `cdn.queue-park.com`, qui est déclaré dans `IMAGE_ALLOWED_HOSTS`.
 * `next/image` l'optimise donc directement, comme sur la vraie page du parc
 * (`components/parks/cover-image.tsx`). La faire passer par `/api/image` la
 * ferait transiter deux fois par notre serveur pour rien.
 */
const PARK_COVER =
  "https://cdn.queue-park.com/images/parks/cedar-point/ab29d92351c7.webp";

/** La photo de repli de Queue Park, quand la signature n'est pas possible. */
const DEFAULT_COVER = "/default_cover.webp";

export type WhatsNewBanners = {
  /** Bannière d'attraction, chemin local signé. */
  ride: string;
  /** Cover de parc, URL du CDN. */
  park: string;
};

/**
 * Les deux images de l'annonce, prêtes à être rendues.
 *
 * ⚠️ **Le repli sur `default_cover.webp` n'est pas de la prudence de façade** :
 * `proxiedImageUrl` LÈVE quand `AUTH_SECRET` manque, et ce module est appelé
 * depuis le layout — c'est-à-dire sur toutes les pages du site. Sans ce
 * garde-fou, un `.env` incomplet ne ferait pas disparaître une vignette
 * d'annonce : il ferait tomber le site entier.
 */
export function whatsNewBanners(): WhatsNewBanners {
  let ride = DEFAULT_COVER;
  try {
    ride = proxiedImageUrl(RIDE_BANNER) ?? DEFAULT_COVER;
  } catch {
    // AUTH_SECRET absent : l'annonce garde la photo de repli, le site vit.
  }
  return { ride, park: PARK_COVER };
}
