// « Cette requête nous arrive-t-elle par Cloudflare ? »
//
// ⚠️ **C'est un test de CONFIANCE, pas une information décorative.** Il commande
// la lecture de `cf-connecting-ip` (voir `getClientIp` dans lib/ip-rules.ts) :
// cet en-tête n'est qu'une chaîne de caractères, et n'importe qui atteignant
// l'origine peut y écrire l'adresse de son choix — donc s'attribuer l'IP d'un
// tiers, ou en changer à chaque requête pour esquiver une blacklist. Le croire
// sans condition serait pire que de ne pas le lire du tout.
//
// Et l'origine EST atteignable en direct : mesuré le 2026-08-31, la part du
// trafic venant d'une plage Cloudflare plafonne à ~85 %, jamais 100 %. Les 15 %
// restants ne passent pas par le proxy — leur `cf-connecting-ip` ne vaut rien.
//
// Le pair est identifié par `x-forwarded-for[0]`, que le proxy interne remplace
// par l'adresse de celui qui se connecte à lui. C'est précisément ce
// remplacement qui a fait perdre les IPs des visiteurs le 2026-08-26 ; ici il
// rend service, puisqu'il nous dit qui nous parle vraiment.

/**
 * Plages publiées par Cloudflare — https://www.cloudflare.com/ips/
 *
 * ⚠️ Cette liste **évolue**, rarement mais réellement. Une plage ajoutée chez
 * eux et pas ici ne provoque aucune erreur visible : le trafic qui en vient
 * cesse simplement d'être reconnu, et les visiteurs concernés réapparaissent
 * sous l'adresse du datacenter au lieu de la leur. Symptôme à connaître, sinon
 * on cherchera le bug dans `getClientIp`.
 *
 * Relevé le 2026-08-31.
 */
const CLOUDFLARE_IPV4 = [
  "173.245.48.0/20",
  "103.21.244.0/22",
  "103.22.200.0/22",
  "103.31.4.0/22",
  "141.101.64.0/18",
  "108.162.192.0/18",
  "190.93.240.0/20",
  "188.114.96.0/20",
  "197.234.240.0/22",
  "198.41.128.0/17",
  "162.158.0.0/15",
  "104.16.0.0/13",
  "104.24.0.0/14",
  "172.64.0.0/13",
  "131.0.72.0/22",
] as const;

const CLOUDFLARE_IPV6 = [
  "2400:cb00::/32",
  "2606:4700::/32",
  "2803:f800::/32",
  "2405:b500::/32",
  "2405:8100::/32",
  "2a06:98c0::/29",
  "2c0f:f248::/32",
] as const;

/**
 * Une adresse IPv4 en entier non signé, ou `null` si ce n'en est pas une.
 *
 * ⚠️ Multiplication et non décalage binaire : `<<` travaille sur 32 bits
 * SIGNÉS en JavaScript, donc toute adresse à partir de 128.0.0.0 — la moitié de
 * l'espace, Cloudflare compris — serait devenue négative.
 */
function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let value = 0;
  for (const part of parts) {
    // `Number("")` vaut 0 et `Number(" 1 ")` vaut 1 : sans ce test, `1..2.3` et
    // les adresses espacées passeraient pour valides.
    if (!/^\d{1,3}$/.test(part)) return null;
    const octet = Number(part);
    if (octet > 255) return null;
    value = value * 256 + octet;
  }
  return value;
}

function ipv4InCidr(value: number, cidr: string): boolean {
  const [base, bitsRaw] = cidr.split("/");
  const baseValue = ipv4ToInt(base);
  const bits = Number(bitsRaw);
  if (baseValue === null || !Number.isInteger(bits)) return false;
  if (bits === 0) return true;
  // Division plutôt que masque, toujours pour éviter l'arithmétique signée.
  const size = 2 ** (32 - bits);
  return Math.floor(value / size) === Math.floor(baseValue / size);
}

/** Les 8 groupes de 16 bits d'une IPv6, `::` développé, ou `null`. */
function ipv6ToGroups(ip: string): number[] | null {
  // Un en-tête peut porter les crochets d'une adresse avec port, ou un
  // identifiant de zone (`%eth0`) sur une adresse locale.
  const cleaned = ip.trim().replace(/^\[/, "").replace(/\]$/, "").split("%")[0];
  if (!cleaned.includes(":")) return null;

  const halves = cleaned.split("::");
  if (halves.length > 2) return null;

  const parseGroups = (part: string) => {
    if (!part) return [];
    const out: number[] = [];
    for (const chunk of part.split(":")) {
      if (!/^[0-9a-fA-F]{1,4}$/.test(chunk)) return null;
      out.push(parseInt(chunk, 16));
    }
    return out;
  };

  const head = parseGroups(halves[0]);
  if (head === null) return null;

  if (halves.length === 1) {
    return head.length === 8 ? head : null;
  }

  const tail = parseGroups(halves[1]);
  if (tail === null) return null;

  const missing = 8 - head.length - tail.length;
  if (missing < 0) return null;
  return [...head, ...new Array(missing).fill(0), ...tail];
}

function ipv6InPrefix(groups: number[], cidr: string): boolean {
  const [base, bitsRaw] = cidr.split("/");
  const baseGroups = ipv6ToGroups(base);
  const bits = Number(bitsRaw);
  if (baseGroups === null || !Number.isInteger(bits)) return false;

  let remaining = bits;
  for (let i = 0; i < 8 && remaining > 0; i++) {
    const take = Math.min(16, remaining);
    const mask = take === 16 ? 0xffff : (0xffff << (16 - take)) & 0xffff;
    if ((groups[i] & mask) !== (baseGroups[i] & mask)) return false;
    remaining -= take;
  }
  return true;
}

/**
 * L'adresse appartient-elle à une plage Cloudflare ?
 *
 * Une adresse absente, vide ou illisible rend `false` : le doute profite au
 * refus, puisque la seule chose qu'un `true` autorise est de faire confiance à
 * un en-tête posé par le client.
 */
export function isCloudflareIp(ip: string | null | undefined): boolean {
  if (!ip) return false;
  const candidate = ip.trim();
  if (!candidate) return false;

  const asV4 = ipv4ToInt(candidate);
  if (asV4 !== null) {
    return CLOUDFLARE_IPV4.some((cidr) => ipv4InCidr(asV4, cidr));
  }

  const asV6 = ipv6ToGroups(candidate);
  if (asV6 !== null) {
    return CLOUDFLARE_IPV6.some((cidr) => ipv6InPrefix(asV6, cidr));
  }

  return false;
}
