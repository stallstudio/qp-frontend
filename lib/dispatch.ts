import { cache } from "react";
import { isAdminViewer } from "@/lib/auth-helpers";
import type { OpeningPeriod } from "@/lib/park-closing";
import type { PoiKind } from "@/lib/poi-kinds";
import type {
  ParkIdentity,
  ParkList,
  ParkLiveData,
  RideIdentity,
} from "@/types/api";

// ————————————————————————————————————————————————————————————————————————
// L'API DISPATCH : toutes les données des parcs viennent d'elle.
//
// Queue Park ne lit plus la base principale ; il ne garde que la sienne
// (comptes, favoris, alertes, rappels). L'API est jointe par le réseau Docker
// de Dokploy (`DISPATCH_API_URL`, sans domaine public), avec la clé de Queue
// Park (`DISPATCH_API_KEY`).
//
// ⚠️ **Queue Park appelle pour le compte de son visiteur**, qu'il décrit par
// les en-têtes `X-Viewer-*` : son IP (`getClientIp`), son user agent, sa
// session admin, l'e-mail de son compte. C'est l'API qui applique la blacklist
// des routes de données et le plafond des signalements à partir d'eux.
//
// ⚠️ **La session n'est lue qu'après un 404** (`isAdminViewer`) : on appelle
// d'abord en simple visiteur, et seul un parc introuvable fait relire la
// session puis rappeler en admin. Le chemin nominal, y compris le
// rafraîchissement de chaque visiteur, n'en lit aucune.
// ————————————————————————————————————————————————————————————————————————

type Viewer = {
  ip?: string;
  userAgent?: string | null;
  admin?: boolean;
  email?: string | null;
};

export function dispatchFetch(
  path: string,
  options: {
    /** Corps JSON, sérialisé ici. */
    json?: unknown;
    /** Corps déjà sérialisé, relayé tel quel (celui du visiteur). */
    raw?: string;
    viewer?: Viewer;
    signal?: AbortSignal;
  } = {},
): Promise<Response> {
  const baseUrl = process.env.DISPATCH_API_URL?.replace(/\/+$/, "");
  const key = process.env.DISPATCH_API_KEY;
  // Au build (GitHub Actions), ni l'une ni l'autre : les pages prérendues
  // retombent sur leur repli, comme quand l'API ne répond pas.
  if (!baseUrl || !key) {
    return Promise.reject(new Error("DISPATCH_API_URL / DISPATCH_API_KEY absentes"));
  }

  const headers = new Headers({ authorization: `Bearer ${key}` });
  const { json, raw, viewer, signal } = options;
  const body = raw ?? (json === undefined ? undefined : JSON.stringify(json));
  if (body !== undefined) headers.set("content-type", "application/json");
  if (viewer?.ip) headers.set("x-viewer-ip", viewer.ip);
  if (viewer?.userAgent) headers.set("x-viewer-user-agent", viewer.userAgent);
  if (viewer?.admin) headers.set("x-viewer-admin", "1");
  if (viewer?.email) headers.set("x-viewer-email", viewer.email);

  return fetch(`${baseUrl}${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers,
    body,
    signal,
  });
}

/**
 * Appelle en simple visiteur, puis — sur un 404 seulement, et pour un admin —
 * rappelle avec l'aperçu des parcs masqués.
 */
export async function dispatchFetchForViewer(
  path: string,
  options: { viewer?: Viewer; signal?: AbortSignal } = {},
): Promise<Response> {
  const response = await dispatchFetch(path, options);
  if (response.status !== 404 || !(await isAdminViewer())) return response;
  return dispatchFetch(path, {
    ...options,
    viewer: { ...options.viewer, admin: true },
  });
}

/**
 * La réponse de l'API, rendue telle quelle au navigateur : statut, corps, et
 * les seuls en-têtes qui décrivent la réponse (type, cache, délai avant
 * nouvel essai, tampon du flux).
 * Les en-têtes de connexion, eux, appartiennent à chaque saut.
 */
export function relay(response: Response): Response {
  const headers = new Headers();
  for (const name of [
    "content-type",
    "cache-control",
    "retry-after",
    "x-accel-buffering",
  ]) {
    const value = response.headers.get(name);
    if (value !== null) headers.set(name, value);
  }
  return new Response(response.body, { status: response.status, headers });
}

async function dataOf<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw new Error(`API Dispatch : ${response.status} sur ${response.url}`);
  }
  return ((await response.json()) as { data: T }).data;
}

const segment = encodeURIComponent;

// ————————————————————————————— Pages —————————————————————————————

/**
 * La liste des parcs de l'accueil, pays traduits dans `locale`, et les
 * IDENTIFIANTS des parcs populaires. Lève si l'API ne répond pas.
 */
export async function getHomeData(
  locale: string,
): Promise<{ parks: ParkList[]; popularParks: string[] }> {
  return dataOf(await dispatchFetch(`/v1/home?locale=${segment(locale)}`));
}

/** `null` = introuvable (ou masqué), `undefined` = API injoignable. */
async function lookup<T>(response: Promise<Response>): Promise<T | null | undefined> {
  try {
    const res = await response;
    if (res.status === 404) return null;
    if (!res.ok) return undefined;
    return ((await res.json()) as { data: T }).data;
  } catch {
    return undefined;
  }
}

/** Le parc publié, sans repli admin (vignettes de partage). */
export const getParkIdentity = cache((identifier: string) =>
  lookup<ParkIdentity>(dispatchFetch(`/v1/parks/${segment(identifier)}`)),
);

/** Le parc tel que le voit le visiteur : masqué compris pour un admin. */
export const resolveParkForViewer = cache((identifier: string) =>
  lookup<ParkIdentity>(dispatchFetchForViewer(`/v1/parks/${segment(identifier)}`)),
);

/**
 * Le parc et l'attraction d'un lien profond, tels que les voit le visiteur.
 * `slug` est le segment d'URL (`123-space-mountain`, ou un ancien nom).
 */
export const resolveRideForViewer = cache(
  (identifier: string, slug: string) =>
    lookup<{ park: ParkIdentity; ride: RideIdentity }>(
      dispatchFetchForViewer(`/v1/parks/${segment(identifier)}/rides/${segment(slug)}`),
    ),
);

/**
 * L'attraction `rideId` d'un parc publié, sans repli admin (vignettes de
 * partage).
 */
export const getRideIdentity = cache(
  async (identifier: string, rideId: number) => {
    const resolved = await lookup<{ park: ParkIdentity; ride: RideIdentity }>(
      dispatchFetch(`/v1/parks/${segment(identifier)}/rides/${rideId}`),
    );
    return resolved && resolved.ride;
  },
);

type ParkLiveResult =
  | { status: "ok"; data: ParkLiveData }
  | { status: "not-found" }
  | { status: "error" };

async function liveResult(response: Promise<Response>): Promise<ParkLiveResult> {
  const data = await lookup<ParkLiveData>(response);
  if (data === null) return { status: "not-found" };
  if (data === undefined) return { status: "error" };
  return { status: "ok", data };
}

/**
 * Les données live d'un parc publié, sans repli admin (vignettes de partage).
 *
 * ⚠️ Sans `X-Viewer-Ip` : la blacklist des pages est déjà appliquée par
 * `middleware.ts`, et une vignette n'a pas de visiteur.
 */
export const buildParkLiveData = cache((identifier: string) =>
  liveResult(dispatchFetch(`/v1/parks/${segment(identifier)}/live`)),
);

/** Les données live d'un parc tel que le voit le visiteur (pages). */
export const buildParkLiveDataForViewer = cache((identifier: string) =>
  liveResult(dispatchFetchForViewer(`/v1/parks/${segment(identifier)}/live`)),
);

/** Les parcs affichables, pour le sitemap. Lève si l'API ne répond pas. */
export async function getSitemapParks(): Promise<
  { identifier: string; updatedAt: string }[]
> {
  return (
    await dataOf<{ parks: { identifier: string; updatedAt: string }[] }>(
      await dispatchFetch("/v1/sitemap"),
    )
  ).parks;
}

// ———————————————————— Règles d'accès et journal ————————————————————

export type AccessRuleType = "whitelist" | "blacklist";

/** Les règles d'accès des pages (`middleware.ts`). Lève si l'API ne répond pas. */
export async function getAccessRules(): Promise<{
  ips: { ipAddress: string; type: AccessRuleType }[];
  userAgents: { pattern: string; type: AccessRuleType }[];
}> {
  return dataOf(await dispatchFetch("/v1/access-rules"));
}

type ParkRequestLogEntry = {
  endpoint: string;
  parkId: string | null;
  ipAddress: string;
  userAgent: string | null;
  referer: string | null;
  statusCode: number;
};

/**
 * Une consultation pour le journal (`api_request_logs`), qui alimente le
 * classement des parcs populaires et la page Requests de l'admin.
 *
 * ⚠️ **Jamais attendu, et son échec ne remonte pas** : une réponse ne doit
 * pas dépendre de l'écriture d'un journal.
 */
export function logParkRequest(entry: ParkRequestLogEntry): void {
  dispatchFetch("/v1/request-logs", { json: entry })
    .then((response) => {
      if (!response.ok) {
        console.error(`Request log refused (${response.status})`, entry.endpoint);
      }
    })
    .catch((error) => console.error("Failed to log request", error));
}

/**
 * Purge de rétention du journal, par lots, au plus une fois par heure.
 * `null` = déjà faite dans l'heure.
 */
export async function purgeOldRequestLogs(): Promise<number | null> {
  return (
    await dataOf<{ purged: number | null }>(
      await dispatchFetch("/v1/request-logs/purge", { json: {} }),
    )
  ).purged;
}

// ——————————— Ce que les comptes (alertes, rappels) lisent des parcs ———————————
//
// ⚠️ **Par lots de mille.** Ces listes viennent de la base utilisateurs, que
// chaque compte remplit à sa guise (une alerte par file, sans plafond) : une
// seule requête finirait par dépasser la taille de corps qu'accepte l'API, et
// c'est le moteur d'alertes de tout le monde qui tomberait avec elle.

const BATCH_SIZE = 1000;

async function inBatches<T, R>(
  items: T[],
  run: (batch: T[]) => Promise<R[]>,
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    results.push(...(await run(items.slice(i, i + BATCH_SIZE))));
  }
  return results;
}

type ParkLookup = {
  id: number;
  identifier: string;
  name: string;
  timezone: string;
  queueTypeLabels: Record<string, string> | null;
};

/** Taille de la colonne `parks.identifier` : au-delà, rien ne peut correspondre. */
const MAX_PARK_IDENTIFIER = 100;

/** Les parcs cités par des données de compte, masqués compris. */
export function lookupParks(identifiers: string[]): Promise<ParkLookup[]> {
  const possible = identifiers.filter((id) => id.length <= MAX_PARK_IDENTIFIER);
  return inBatches(possible, async (batch) =>
    dataOf(await dispatchFetch("/v1/parks/lookup", { json: { identifiers: batch } })),
  );
}

type PoiLookup = {
  id: number;
  kind: string;
  eventId: number | null;
  park: { id: number; identifier: string; timezone: string };
};

/** Les POI visés par des alertes, toutes familles confondues. */
export function lookupPois(ids: number[]): Promise<PoiLookup[]> {
  return inBatches(ids, async (batch) =>
    dataOf(await dispatchFetch("/v1/pois/lookup", { json: { ids: batch } })),
  );
}

type CurrentQueue = {
  poiId: number | null;
  type: string;
  parkId: number;
  waitTime: number;
  waitTimeMin: number | null;
  waitTimeMax: number | null;
  status: string;
  /** Instant où la file est entrée dans son état courant (ISO 8601). */
  startTime: string;
  timeSlot: unknown;
};

/** L'état courant des files de ces types sur ces POI. */
export function currentQueues(
  poiIds: number[],
  queueTypes: string[],
): Promise<CurrentQueue[]> {
  return inBatches(poiIds, (poiBatch) =>
    inBatches(queueTypes, async (typeBatch) =>
      dataOf<CurrentQueue[]>(
        await dispatchFetch("/v1/queues/current", {
          json: { poiIds: poiBatch, queueTypes: typeBatch },
        }),
      ),
    ),
  );
}

/**
 * Périodes d'ouverture courantes des parcs demandés, tous types confondus,
 * groupées par parc. C'est `reopenPeriodsFor` (`lib/park-closing.ts`) qui
 * choisit celles qui s'appliquent.
 */
export async function loadParkHourPeriods(
  parkIds: number[],
): Promise<Map<number, OpeningPeriod[]>> {
  const result = new Map<number, OpeningPeriod[]>();
  const rows = await inBatches(parkIds, async (batch) =>
    dataOf<(OpeningPeriod & { parkId: number })[]>(
      await dispatchFetch("/v1/parks/opening-periods", { json: { parkIds: batch } }),
    ),
  );
  for (const { parkId, ...period } of rows) {
    const list = result.get(parkId) ?? [];
    list.push(period);
    result.set(parkId, list);
  }
  return result;
}

/** Les familles de POI dont le parc publie l'attente (`[]` si parc inconnu). */
export async function getTimedKinds(parkIdentifier: string): Promise<PoiKind[]> {
  const response = await dispatchFetch(
    `/v1/parks/${segment(parkIdentifier)}/timed-kinds`,
  );
  if (response.status === 404) return [];
  return dataOf(response);
}
