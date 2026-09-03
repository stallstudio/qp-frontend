import { createHmac, timingSafeEqual } from "crypto";

/**
 * Les images distantes passent par NOTRE domaine, signées.
 *
 * ⚠️ **Le problème que ça règle.** Les bannières d'attraction viennent de l'API
 * de chaque parc : `www.walibi.be`, `aem.familypark.at`, et un hôte de plus à
 * chaque source qui se met à en publier. L'optimiseur d'images de Next filtre
 * par `remotePatterns`, une liste figée AU BUILD et alimentée par
 * `IMAGE_ALLOWED_HOSTS` : y déclarer chaque parc voudrait dire qu'un nouveau
 * parc casse ses images en silence — un hôte absent ne lève aucune erreur, il
 * renvoie 400 à l'exécution. C'est une liste qui ne peut que se périmer.
 *
 * Une URL passée par ce module devient un chemin RELATIF (`/api/image?...`).
 * Next n'a donc plus d'hôte distant à autoriser, et l'optimisation continue de
 * s'appliquer normalement.
 *
 * ⚠️ **La signature n'est pas décorative : sans elle, c'est un proxy OUVERT** —
 * exactement ce que le commentaire de `next.config.ts` refuse. N'importe qui
 * ferait transiter et redimensionner ses images par notre serveur, à nos frais.
 * Seules les URL que le SERVEUR a signées sont servies ; une URL fabriquée à la
 * main est rejetée sans être fetchée.
 *
 * ⚠️ **Aucune variable d'environnement nouvelle.** La clé dérive d'`AUTH_SECRET`,
 * que `next-auth` exige déjà et sans lequel l'application ne démarre pas en
 * production. La dérivation par étiquette (`HMAC(secret, "image-proxy")`) évite
 * de réutiliser la clé d'authentification telle quelle : une signature d'image
 * ne doit rien pouvoir prouver d'autre.
 *
 * ⚠️ **L'URL source voyage ENCODÉE, et ce n'est pas de la coquetterie** — voir
 * `encoderUrl` plus bas. Un nom de fichier en clair dans la query suffit à
 * faire annuler la requête par les bloqueurs de publicité du visiteur.
 */

const ETIQUETTE = "image-proxy/v1";
const TAILLE_SIGNATURE = 16; // 128 bits : de quoi rendre la forge sans espoir.

function cle(): Buffer {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    // En développement `next-auth` tolère l'absence de secret ; ici, la refuser
    // ferait disparaître toutes les bannières sans dire pourquoi.
    throw new Error(
      "AUTH_SECRET est requis pour signer les images distantes (lib/image-proxy).",
    );
  }
  return createHmac("sha256", secret).update(ETIQUETTE).digest();
}

function signature(url: string): string {
  return createHmac("sha256", cle())
    .update(url)
    .digest()
    .subarray(0, TAILLE_SIGNATURE)
    .toString("base64url");
}

/**
 * Le chemin local qui servira cette image distante, ou `null` si l'URL n'est pas
 * une image distante exploitable.
 *
 * ⚠️ **À n'appeler que côté serveur** : la clé n'existe pas dans le navigateur.
 */
export function proxiedImageUrl(rawUrl: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return null;
  }

  // `https` seulement : un `http` distant ferait passer la page en contenu
  // mixte, et un `data:`/`file:` n'a rien à faire dans un fetch serveur.
  if (parsed.protocol !== "https:") return null;

  const url = parsed.toString();
  return `/api/image?u=${encoderUrl(url)}&s=${signature(url)}`;
}

/**
 * L'URL source, en base64url plutôt qu'en clair.
 *
 * ⚠️ **Un nom de fichier en clair dans la query fait ANNULER la requête par le
 * navigateur du visiteur, et rien côté serveur ne le voit.** Constaté le
 * 2026-08-28 sur `WildChaseWaterCoaster_300x250.jpg` (Sunway Lagoon) :
 * `net::ERR_BLOCKED_BY_CLIENT`, alors que l'URL du parc rend un `200` de
 * 176 Ko. `300x250` est le format IAB « medium rectangle », le pavé
 * publicitaire le plus répandu du web, et les listes de filtres qu'embarquent
 * uBlock Origin, AdBlock ou Brave Shields bloquent génériquement toute URL dont
 * le chemin porte une dimension d'emplacement — sans regarder ce qu'il y a
 * dedans. Le parc a simplement nommé sa vignette d'après la taille d'un pavé.
 *
 * ⚠️ **`encodeURIComponent` ne protégeait de rien** : il n'échappe que les
 * séparateurs, le nom de fichier restait lisible, et le bloqueur lit la chaîne
 * ENTIÈRE — donc aussi le `/_next/image?url=…` qui nous enveloppe. Les deux
 * étages portaient le motif. Le base64url, lui, ne laisse que
 * `A-Za-z0-9-_` : il n'y a plus rien à reconnaître, et il traverse le `url=` de
 * l'optimiseur sans ré-encodage.
 *
 * ⚠️ **La signature ne change pas de portée** : elle porte toujours sur l'URL
 * DÉCODÉE. Cet encodage est un transport, pas un secret — il n'ajoute aucune
 * sécurité et n'en retire aucune.
 *
 * ⚠️ **Ça vise la CLASSE, pas les quatre cas du jour.** Mesuré sur les 21 733
 * bannières du catalogue : quatre visuels portent un format IAB, tous chez
 * Sunway (Wild Chase Coaster, Giraffe & Friends, Hippo Kingdom, Rabbit
 * Wonderland), tous en `300x250`. Mais le symptôme est MUET — la vignette
 * n'apparaît pas, aucune erreur serveur, la même URL s'ouvre très bien à la
 * main — et chaque parc ajouté peut en apporter d'autres (`728x90`, `160x600`,
 * `300x600`…).
 */
function encoderUrl(url: string): string {
  return Buffer.from(url, "utf8").toString("base64url");
}

/**
 * L'URL source telle que la route doit la lire, ou `null` si le paramètre n'en
 * porte pas une.
 *
 * ⚠️ **La forme EN CLAIR est encore acceptée, et c'est temporaire.** Les
 * variantes déjà calculées par l'optimiseur de Next vivent sept jours
 * (`minimumCacheTTL`) et les pages déjà rendues chez un visiteur portent
 * l'ancienne forme : la refuser d'un coup ferait disparaître des bannières le
 * temps que les caches tournent. Un `https://` ne peut pas être du base64url —
 * ni `:` ni `/` n'en font partie —, la distinction est donc exacte et non
 * heuristique. **Supprimable après le 2026-09-05.**
 */
export function decoderUrl(parametre: string): string | null {
  if (parametre.startsWith("https://")) return parametre;

  let decode: string;
  try {
    decode = Buffer.from(parametre, "base64url").toString("utf8");
  } catch {
    return null;
  }
  // Un base64url invalide ne LÈVE pas, il rend des octets arbitraires : c'est
  // ce test qui rejette, pas le `catch`.
  return decode.startsWith("https://") ? decode : null;
}

/** L'URL est-elle bien l'une des nôtres ? Comparaison à temps constant. */
export function verifyImageSignature(url: string, sig: string): boolean {
  let attendue: Buffer;
  try {
    attendue = Buffer.from(signature(url), "base64url");
  } catch {
    return false;
  }
  const fournie = Buffer.from(sig, "base64url");
  if (fournie.length !== attendue.length) return false;
  return timingSafeEqual(fournie, attendue);
}
