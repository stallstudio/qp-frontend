import { createHmac, timingSafeEqual } from "crypto";

/**
 * L'écran d'accès : tout le site derrière un code à 4 chiffres.
 *
 * Le verrou existe dès que `ACCESS_CODE` est défini (ex. `ACCESS_CODE=1234`) et
 * disparaît avec lui. **Aucun build à relancer** : la variable est lue à chaque
 * requête, `middleware.ts` tournant sous Node. Un redémarrage du conteneur
 * suffit pour poser ou lever le verrou.
 *
 * Le code saisi est vérifié par `/api/access`, qui pose un cookie. Ce cookie ne
 * contient PAS le code mais une signature, dérivée d'`AUTH_SECRET` (même
 * principe que `lib/image-proxy`). D'où deux propriétés :
 *   - on ne le fabrique pas sans le secret ;
 *   - changer le code invalide tous les cookies déjà posés : tout le monde
 *     repasse par l'écran.
 *
 * ⚠️ **Le code est attendu en chiffres.** L'écran affiche autant de cases que
 * le code a de caractères et n'accepte que des chiffres : un code avec une
 * lettre ne pourrait jamais être saisi, et fermerait le site à tout le monde.
 */

export const ACCESS_COOKIE = "qp_access";

const TOKEN_LABEL = "access-gate/v1";

/** Le code d'accès, ou `null` quand le site est ouvert à tous. */
export function getAccessCode(): string | null {
  return process.env.ACCESS_CODE?.trim() || null;
}

function token(code: string): Buffer {
  return createHmac("sha256", process.env.AUTH_SECRET ?? "")
    .update(`${TOKEN_LABEL}:${code}`)
    .digest();
}

/** La valeur du cookie qui prouve qu'on a saisi `code`. */
export function accessCookieValue(code: string): string {
  return token(code).toString("base64url");
}

/** Le code saisi est-il le bon ? Comparaison à temps constant. */
export function isAccessCode(attempt: string): boolean {
  const code = getAccessCode();
  return code !== null && timingSafeEqual(token(attempt), token(code));
}

/**
 * Ce cookie ouvre-t-il le site ? Toujours vrai quand aucun code n'est défini.
 */
export function hasAccess(cookieValue: string | undefined): boolean {
  const code = getAccessCode();
  if (!code) return true;
  if (!cookieValue) return false;

  const expected = Buffer.from(accessCookieValue(code));
  const given = Buffer.from(cookieValue);
  return given.length === expected.length && timingSafeEqual(given, expected);
}
