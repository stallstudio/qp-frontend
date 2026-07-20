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

// La clé VAPID publique est en base64url ; PushManager veut un Uint8Array.
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(normalized);
  const out = new Uint8Array(raw.length);
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

// Demande la permission puis crée/réutilise l'abonnement Push. Renvoie la charge
// à persister, ou null si refus/indispo.
export async function subscribeToPush(): Promise<PushSubscriptionPayload | null> {
  if (!isPushSupported()) return null;
  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
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
