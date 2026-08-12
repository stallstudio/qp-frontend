import { getPrisma } from "@/lib/prisma";

type IpRuleType = "whitelist" | "blacklist";

interface IpRulesCache {
  rules: Map<string, IpRuleType>;
  lastFetchedAt: number;
}

const CACHE_TTL_MS = 60_000; // 60 seconds

/**
 * Valeur de repli quand la requête n'expose aucune IP (en-têtes de proxy
 * absents). Ce n'est PAS une adresse : c'est un « je ne sais pas ».
 */
export const UNKNOWN_IP = "unknown";

/**
 * L'IP du client, telle que la pose le reverse proxy.
 *
 * Centralisée pour que la valeur de repli soit la MÊME chaîne que celle
 * qu'écartent les règles ci-dessous — elle était recopiée en littéral dans
 * chaque route, si bien qu'un jour on l'aurait écrite autrement d'un côté.
 */
export function getClientIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0] ??
    request.headers.get("x-real-ip") ??
    UNKNOWN_IP
  );
}

const globalForIpRules = globalThis as unknown as {
  ipRulesCache: IpRulesCache | undefined;
};

async function refreshCache(): Promise<Map<string, IpRuleType>> {
  const prisma = getPrisma();
  const rules = await prisma.ipRule.findMany({
    select: { ipAddress: true, type: true },
  });

  const map = new Map<string, IpRuleType>();
  for (const rule of rules) {
    // ⚠️ **Une règle posée sur `"unknown"` est ignorée, et c'est délibéré.**
    // Ce n'est pas l'adresse de quelqu'un mais le repli de TOUTES les requêtes
    // dont le proxy n'a pas transmis l'IP : la blacklister bannirait ce trafic
    // en bloc, la whitelister le sortirait en bloc du classement des parcs
    // populaires. Or elle apparaît dans la page Requests de l'admin comme
    // n'importe quelle autre ligne — souvent en tête, puisqu'elle agrège — donc
    // rien n'empêche de la bloquer par mégarde. Le garde-fou est ici, au seul
    // endroit que les trois fonctions traversent.
    if (rule.ipAddress === UNKNOWN_IP) continue;
    map.set(rule.ipAddress, rule.type);
  }

  globalForIpRules.ipRulesCache = {
    rules: map,
    lastFetchedAt: Date.now(),
  };

  return map;
}

export async function getIpRules(): Promise<Map<string, IpRuleType>> {
  const cache = globalForIpRules.ipRulesCache;

  if (cache && Date.now() - cache.lastFetchedAt < CACHE_TTL_MS) {
    return cache.rules;
  }

  return refreshCache();
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
