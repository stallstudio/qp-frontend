import { getPrisma } from "@/lib/prisma";
import { isCloudflareIp } from "@/lib/cloudflare-ips";

type IpRuleType = "whitelist" | "blacklist";

/**
 * Valeur de repli quand la requête n'expose aucune IP (en-têtes de proxy
 * absents). Ce n'est PAS une adresse : c'est un « je ne sais pas ».
 */
export const UNKNOWN_IP = "unknown";

/**
 * Tout ce dont `getClientIp` a besoin : les `Headers` d'une `Request` comme le
 * `ReadonlyHeaders` de `next/headers` répondent à ce contrat.
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
 * une nuit, sans que le volume bouge. `isBlacklisted`, `getWhitelistedIps` et
 * la page Requests de l'admin portaient depuis sur des datacenters.
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

interface IpRulesCache {
  rules: Map<string, IpRuleType>;
  lastFetchedAt: number;
}

const CACHE_TTL_MS = 60_000; // 60 seconds

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
