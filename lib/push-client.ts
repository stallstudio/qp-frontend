// Helpers Web Push CÔTÉ NAVIGATEUR : enregistrement du service worker, (dés)abon-
// nement via PushManager, conversion de la clé VAPID. Le hook usePushNotifications
// s'appuie dessus. Tout est best-effort et défensif (APIs indisponibles selon le
// navigateur/plateforme, notamment iOS < 16.4 ou hors PWA).

const SW_URL = "/sw.js";

// true si le navigateur supporte le Web Push (SW + PushManager + Notification).
export function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

// La clé VAPID publique est en base64url ; PushManager veut un BufferSource.
// On construit sur un ArrayBuffer EXPLICITE (et on type le retour en
// `Uint8Array<ArrayBuffer>`) : avec les TS récents `Uint8Array` est générique et
// `Uint8Array<ArrayBufferLike>` n'est pas assignable à `BufferSource` (le buffer
// pourrait être un SharedArrayBuffer).
function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(normalized);
  const buffer = new ArrayBuffer(raw.length);
  const out = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

// Enregistre (ou récupère) le service worker. On attend qu'il soit prêt pour
// pouvoir s'abonner tout de suite après.
export async function ensureServiceWorker(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration(SW_URL);
  if (existing) return existing;
  await navigator.serviceWorker.register(SW_URL);
  return navigator.serviceWorker.ready;
}

// Forme d'abonnement envoyée à l'API (endpoint + clés extraites du PushSubscription).
export type PushSubscriptionPayload = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

function serialize(sub: PushSubscription): PushSubscriptionPayload | null {
  const json = sub.toJSON();
  const p256dh = json.keys?.p256dh;
  const auth = json.keys?.auth;
  if (!json.endpoint || !p256dh || !auth) return null;
  return { endpoint: json.endpoint, p256dh, auth };
}

/**
 * La clé publique VAPID, avec repli serveur.
 *
 * ⚠️ `process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY` est inlinée dans ce bundle au
 * `next build` : une image compilée sans le build-arg (voir le `Dockerfile` et
 * `.github/workflows/build.yml`) la porte VIDE, et plus personne ne peut
 * s'abonner — silencieusement, puisque la fonction se contentait de renvoyer
 * `null`. C'est arrivé en production.
 *
 * Le serveur sait toujours lire la vraie variable du conteneur : on lui demande
 * plutôt que d'abandonner. Le cas nominal ne paie rien — la valeur inlinée est
 * là, on ne va pas sur le réseau.
 */
async function resolveVapidKey(): Promise<string | null> {
  const inlined = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (inlined) return inlined;

  // Best-effort, comme le reste du module : hors ligne ou clé absente côté
  // serveur aussi, on renonce à l'abonnement plutôt que de lever.
  try {
    const res = await fetch("/api/push/vapid-public-key");
    if (!res.ok) return null;
    const { key } = (await res.json()) as { key?: string };
    return key || null;
  } catch {
    return null;
  }
}

// Demande la permission puis crée/réutilise l'abonnement Push. Renvoie la charge
// à persister, ou null si refus/indispo.
export async function subscribeToPush(): Promise<PushSubscriptionPayload | null> {
  if (!isPushSupported()) return null;
  const vapidKey = await resolveVapidKey();
  if (!vapidKey) return null;

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return null;

  const registration = await ensureServiceWorker();
  const existing = await registration.pushManager.getSubscription();
  const sub =
    existing ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey),
    }));

  return serialize(sub);
}

// Retourne l'abonnement courant de cet appareil s'il existe (sans en créer).
export async function getExistingSubscription(): Promise<PushSubscriptionPayload | null> {
  if (!isPushSupported()) return null;
  const registration = await navigator.serviceWorker.getRegistration(SW_URL);
  if (!registration) return null;
  const sub = await registration.pushManager.getSubscription();
  return sub ? serialize(sub) : null;
}

// Désabonne l'appareil (côté navigateur). Renvoie l'endpoint supprimé pour que
// l'appelant le retire aussi côté serveur, ou null s'il n'y avait rien.
export async function unsubscribeFromPush(): Promise<string | null> {
  if (!isPushSupported()) return null;
  const registration = await navigator.serviceWorker.getRegistration(SW_URL);
  if (!registration) return null;
  const sub = await registration.pushManager.getSubscription();
  if (!sub) return null;
  const endpoint = sub.endpoint;
  await sub.unsubscribe();
  return endpoint;
}

export function notificationPermission(): NotificationPermission | null {
  if (typeof Notification === "undefined") return null;
  return Notification.permission;
}
