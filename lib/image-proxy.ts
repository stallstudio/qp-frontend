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
  return `/api/image?u=${encodeURIComponent(url)}&s=${signature(url)}`;
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
