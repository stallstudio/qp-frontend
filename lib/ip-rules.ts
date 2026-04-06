import { getPrisma } from "@/lib/prisma";

type IpRuleType = "whitelist" | "blacklist";

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
