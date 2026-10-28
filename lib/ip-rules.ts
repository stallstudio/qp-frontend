import { isCloudflareIp } from "@/lib/cloudflare-ips";
import { getAccessRules as fetchAccessRules, type AccessRuleType } from "@/lib/dispatch";

// L'IP réelle du visiteur, et les règles d'accès que `middleware.ts` applique
// aux PAGES (elles servent les mêmes données que l'API). DEUX familles,
// indépendantes et cumulatives : par ADRESSE (`ip_rules`) et par USER AGENT
// (`user_agent_rules`). Une requête est refusée si son IP est blacklistée OU si
// son user agent l'est.
//
// Les routes de données, elles, sont filtrées par l'API Dispatch, à qui Queue
// Park transmet l'IP et le user agent du visiteur (`X-Viewer-*`).

interface UserAgentRule {
  /** Fragment cherché dans le user agent, DÉJÀ en minuscules. */
  pattern: string;
  type: AccessRuleType;
}

interface AccessRulesCache {
  ips: Map<string, AccessRuleType>;
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
 * Ramène les deux formes acceptées à un lecteur d'en-têtes.
 *
 * ⚠️ **On discrimine sur `get`, JAMAIS sur la présence d'un champ `headers`.**
 * Le `ReadonlyHeaders` de `next/headers` PORTE un champ `headers` : c'est le sac
 * d'en-têtes brut (un objet nu `{ "x-forwarded-for": "…" }` derrière un Proxy),
 * pas un `Headers`. Un test `"headers" in source` prenait donc la branche
 * `Request` pour un `ReadonlyHeaders` et renvoyait cet objet nu, dépourvu de
 * `.get` — d'où le `TypeError: get is not a function` qui, en production, tuait
 * le `after()` des pages parc et attraction. Silencieusement : `after()` avale
 * l'erreur dans les logs, la page se rend normalement, et seul le journal des
 * consultations (donc le classement des parcs populaires) manquait à l'appel.
 *
 * `Request` n'expose pas de `get` ; `Headers` et `ReadonlyHeaders` si. Le test
 * ci-dessous sépare les deux formes sans dépendre d'un champ interne de Next.
 */
function toHeaderReader(source: Request | HeaderReader): HeaderReader {
  return typeof (source as HeaderReader).get === "function"
    ? (source as HeaderReader)
    : (source as Request).headers;
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
  const headers = toHeaderReader(source);

  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();

  const cloudflareIp = headers.get("cf-connecting-ip")?.trim();
  if (cloudflareIp && isCloudflareIp(forwarded)) {
    return cloudflareIp;
  }

  return forwarded || headers.get("x-real-ip") || UNKNOWN_IP;
}

const globalForAccessRules = globalThis as unknown as {
  accessRulesCache: AccessRulesCache | undefined;
  accessRulesRefresh: Promise<AccessRulesCache> | undefined;
};

/**
 * Les règles telles que l'API les prépare : règle posée sur `"unknown"`
 * écartée (ce n'est pas une adresse mais le repli de TOUTES les requêtes sans
 * IP), fragments de user agent en minuscules, fragments vides écartés (ils
 * banniraient le site entier).
 */
async function loadAccessRules(): Promise<AccessRulesCache> {
  const rules = await fetchAccessRules();
  return {
    ips: new Map(rules.ips.map((rule) => [rule.ipAddress, rule.type])),
    userAgents: rules.userAgents,
    lastFetchedAt: Date.now(),
  };
}

/**
 * Relit les règles, une seule lecture à la fois.
 *
 * ⚠️ **Un échec ne rejette pas : il garde les règles précédentes (ou aucune,
 * au démarrage) pendant un TTL.** `middleware.ts` contrôle chaque page : une
 * lecture qui échoue sans rien mettre en cache serait relancée par CHAQUE
 * requête, et chacune attendrait l'API. Mesuré le 2026-10-27 sur une base
 * figée : 10 s pour `/about`, une page qui ne lit pourtant rien. On laisse
 * passer une IP blacklistée pendant une panne. C'est mieux que de faire
 * attendre tout le monde.
 */
function refreshCache(): Promise<AccessRulesCache> {
  globalForAccessRules.accessRulesRefresh ??= loadAccessRules()
    .catch((error): AccessRulesCache => {
      console.error("Failed to load access rules", error);
      const previous = globalForAccessRules.accessRulesCache;
      return {
        ips: previous?.ips ?? new Map(),
        userAgents: previous?.userAgents ?? [],
        lastFetchedAt: Date.now(),
      };
    })
    .then((cache) => {
      globalForAccessRules.accessRulesCache = cache;
      return cache;
    })
    .finally(() => {
      globalForAccessRules.accessRulesRefresh = undefined;
    });
  return globalForAccessRules.accessRulesRefresh;
}

async function getAccessRules(): Promise<AccessRulesCache> {
  const cache = globalForAccessRules.accessRulesCache;

  // Seul le tout premier appel attend l'API. Une fois le cache expiré, on
  // sert encore les règles en cache et on les relit en arrière-plan : une
  // règle posée dans l'admin prend effet un TTL plus tard, comme avant, mais
  // aucune requête ne paie plus la lecture.
  if (!cache) return refreshCache();
  if (Date.now() - cache.lastFetchedAt >= CACHE_TTL_MS) void refreshCache();
  return cache;
}

export async function isBlacklisted(ip: string): Promise<boolean> {
  const { ips } = await getAccessRules();
  return ips.get(ip) === "blacklist";
}

/**
 * Le user agent porte-t-il un fragment BLACKLISTÉ ?
 *
 * ⚠️ **La whitelist n'entre PAS en jeu ici**, et ce n'est pas un oubli : une
 * règle `whitelist` ne veut pas dire « autorisé malgré tout », elle veut dire
 * « ne compte pas dans les statistiques » (l'API en sort les requêtes du
 * classement des parcs populaires). Lui faire lever un blocage lui donnerait un
 * second sens, invisible depuis l'admin où les deux boutons se ressemblent.
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
