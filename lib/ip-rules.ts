import { getPrisma } from "@/lib/prisma";
import { isCloudflareIp } from "@/lib/cloudflare-ips";

// Règles d'accès aux routes de données publiques. DEUX familles, indépendantes
// et cumulatives : par ADRESSE (`ip_rules`) et par USER AGENT
// (`user_agent_rules`). Une requête est refusée si son IP est blacklistée OU si
// son user agent l'est.
//
// ⚠️ Le fichier s'appelle encore `ip-rules` pour ne pas casser ses appelants,
// mais il ne parle plus que d'IP : le blocage par user agent vit ici aussi,
// parce qu'il partage le cache, le TTL et le garde-fou `UNKNOWN_IP`. Chercher
// « blocage user agent » ailleurs ne donnerait rien.

type IpRuleType = "whitelist" | "blacklist";

interface UserAgentRule {
  /** Fragment cherché dans le user agent, DÉJÀ en minuscules. */
  pattern: string;
  type: IpRuleType;
}

interface AccessRulesCache {
  ips: Map<string, IpRuleType>;
  userAgents: UserAgentRule[];
  lastFetchedAt: number;
}

const CACHE_TTL_MS = 60_000; // 60 seconds

/**
 * Valeur de repli quand la requête n'expose aucune IP (en-têtes de proxy
 * absents). Ce n'est PAS une adresse : c'est un « je ne sais pas ».
 */
export const UNKNOWN_IP = "unknown";

/**
 * Tout ce dont `getClientIp` a besoin : les `Headers` d'une `Request` comme le
 * `ReadonlyHeaders` de `next/headers` répondent à ce contrat. C'est ce qui
 * permet aux composants serveur d'appeler la même fonction que les routes —
 * ils recopiaient la logique en littéral, et ne l'auraient pas suivie ici.
 */
interface HeaderReader {
  get(name: string): string | null;
}

/**
 * L'IP réelle du client.
 *
 * ⚠️ **`x-forwarded-for` ne suffit plus depuis le 2026-08-26.** Ce jour-là la
 * zone DNS est passée chez Cloudflare, qui proxifie par défaut les
 * enregistrements qu'il importe : un reverse proxy s'est retrouvé devant le
 * site. Le proxy interne remplaçant `x-forwarded-for` par l'adresse de son
 * pair, on n'enregistrait plus le visiteur mais le datacenter qui relaie sa
 * requête — les IPs distinctes du journal sont tombées de **2 214 à ~500** en
 * une nuit, sans que le volume bouge. Toute la page Requests de l'admin, les
 * whitelists et le classement des parcs populaires portaient depuis sur des
 * datacenters.
 *
 * `cf-connecting-ip` porte l'adresse d'origine, et aucun proxy interne ne le
 * réécrit. D'où l'ordre ci-dessous.
 *
 * ⚠️ **Mais il n'est lu QUE si le pair est bien Cloudflare**, et ce garde-fou
 * n'est pas une précaution de principe : l'origine reste joignable en direct
 * (~15 % du trafic ne passe pas par le proxy), et cet en-tête n'est qu'une
 * chaîne que n'importe quel client peut écrire. Le lire sans condition
 * offrirait à qui le veut le moyen de choisir son IP — donc de se faire passer
 * pour un tiers, ou d'en changer à chaque requête pour esquiver une blacklist.
 * On aurait remplacé une adresse fausse mais honnête par une adresse
 * falsifiable.
 *
 * ⚠️ Le repli reste `x-forwarded-for` : sans lui, les 15 % de trafic direct
 * n'auraient plus d'adresse du tout.
 */
export function getClientIp(source: Request | HeaderReader): string {
  const headers: HeaderReader = "headers" in source ? source.headers : source;

  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();

  const cloudflareIp = headers.get("cf-connecting-ip")?.trim();
  if (cloudflareIp && isCloudflareIp(forwarded)) {
    return cloudflareIp;
  }

  return forwarded || headers.get("x-real-ip") || UNKNOWN_IP;
}

const globalForAccessRules = globalThis as unknown as {
  accessRulesCache: AccessRulesCache | undefined;
};

async function refreshCache(): Promise<AccessRulesCache> {
  const prisma = getPrisma();

  // Les deux tables partent ENSEMBLE : elles ont le même TTL et sont lues sur
  // le même chemin (chaque requête de parc). Enchaînées, la route paierait deux
  // allers-retours au lieu d'un à chaque expiration du cache.
  const [ipRules, uaRules] = await Promise.all([
    prisma.ipRule.findMany({ select: { ipAddress: true, type: true } }),
    // ⚠️ **Cette lecture-ci est TOLÉRANTE À L'ÉCHEC, l'autre non.** Elle porte
    // sur une table arrivée après coup (`user_agent_rules`, migration du
    // 2026-08-31) : un déploiement passé avant sa migration ferait rejeter le
    // `Promise.all`, donc `isBlacklisted`, donc **toutes** les routes de parc —
    // le site entier en 500 parce qu'un anti-abus n'a pas trouvé sa table. Le
    // repli est de ne plus filtrer par user agent, jamais de tomber.
    //
    // Le `ipRule.findMany` juste au-dessus, lui, garde son comportement : sa
    // table est là depuis toujours, et son absence signalerait une base
    // inaccessible — qu'aucun repli ne sauverait.
    prisma.userAgentRule
      .findMany({ select: { pattern: true, type: true } })
      .catch((error) => {
        console.error("Failed to load user agent rules", error);
        return [] as Array<{ pattern: string; type: IpRuleType }>;
      }),
  ]);

  const ips = new Map<string, IpRuleType>();
  for (const rule of ipRules) {
    // ⚠️ **Une règle posée sur `"unknown"` est ignorée, et c'est délibéré.**
    // Ce n'est pas l'adresse de quelqu'un mais le repli de TOUTES les requêtes
    // dont le proxy n'a pas transmis l'IP : la blacklister bannirait ce trafic
    // en bloc, la whitelister le sortirait en bloc du classement des parcs
    // populaires. Or elle apparaît dans la page Requests de l'admin comme
    // n'importe quelle autre ligne — souvent en tête, puisqu'elle agrège — donc
    // rien n'empêche de la bloquer par mégarde. Le garde-fou est ici, au seul
    // endroit que les trois fonctions traversent.
    if (rule.ipAddress === UNKNOWN_IP) continue;
    ips.set(rule.ipAddress, rule.type);
  }

  const userAgents: UserAgentRule[] = [];
  for (const rule of uaRules) {
    const pattern = rule.pattern.trim().toLowerCase();
    // Même esprit que le garde-fou `UNKNOWN_IP` : un fragment vide est contenu
    // dans TOUS les user agents et bannirait le site entier. L'API de l'admin
    // le refuse déjà à l'écriture ; le filet est ici parce que c'est le seul
    // point de passage, et qu'une ligne peut aussi être posée à la main en SQL.
    if (!pattern) continue;
    userAgents.push({ pattern, type: rule.type });
  }

  const cache: AccessRulesCache = {
    ips,
    userAgents,
    lastFetchedAt: Date.now(),
  };
  globalForAccessRules.accessRulesCache = cache;
  return cache;
}

async function getAccessRules(): Promise<AccessRulesCache> {
  const cache = globalForAccessRules.accessRulesCache;

  if (cache && Date.now() - cache.lastFetchedAt < CACHE_TTL_MS) {
    return cache;
  }

  return refreshCache();
}

export async function getIpRules(): Promise<Map<string, IpRuleType>> {
  return (await getAccessRules()).ips;
}

export async function isBlacklisted(ip: string): Promise<boolean> {
  const rules = await getIpRules();
  return rules.get(ip) === "blacklist";
}

export async function isWhitelisted(ip: string): Promise<boolean> {
  const rules = await getIpRules();
  return rules.get(ip) === "whitelist";
}

export async function getWhitelistedIps(): Promise<string[]> {
  const rules = await getIpRules();
  const ips: string[] = [];
  for (const [ip, type] of rules) {
    if (type === "whitelist") ips.push(ip);
  }
  return ips;
}

/**
 * Le user agent porte-t-il un fragment BLACKLISTÉ ?
 *
 * ⚠️ **La whitelist n'entre PAS en jeu ici**, et ce n'est pas un oubli : une
 * règle `whitelist` ne veut pas dire « autorisé malgré tout », elle veut dire
 * « ne compte pas dans les statistiques » (cf. `getWhitelistedIps`, qui sort
 * ces requêtes du classement des parcs populaires). Lui faire lever un blocage
 * lui donnerait un second sens, invisible depuis l'admin où les deux boutons se
 * ressemblent.
 *
 * Comparaison par SOUS-CHAÎNE en minuscules : `EnergylandiaStatsBot` attrape
 * aussi bien la version 1.0 que la 1.1, là où une égalité sur la famille
 * `EnergylandiaStatsBot/1.0` se contourne en incrémentant un chiffre.
 *
 * Une requête SANS user agent n'est jamais bloquée par ce biais — il n'y a rien
 * à comparer. C'est le blocage par IP qui couvre ce cas.
 */
export async function isUserAgentBlacklisted(
  userAgent: string | null | undefined,
): Promise<boolean> {
  if (!userAgent) return false;
  const { userAgents } = await getAccessRules();
  if (userAgents.length === 0) return false;

  const haystack = userAgent.toLowerCase();
  return userAgents.some(
    (rule) => rule.type === "blacklist" && haystack.includes(rule.pattern),
  );
}

/**
 * Fragments de user agent whitelistés, pour les exclure des statistiques au
 * même titre que les IPs whitelistées.
 */
export async function getWhitelistedUserAgentPatterns(): Promise<string[]> {
  const { userAgents } = await getAccessRules();
  return userAgents
    .filter((rule) => rule.type === "whitelist")
    .map((rule) => rule.pattern);
}
