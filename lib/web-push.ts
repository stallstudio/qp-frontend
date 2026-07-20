import webpush from "web-push";

// Envoi Web Push (VAPID) côté serveur. Utilisé par le moteur d'alertes
// (/api/cron/alerts). Volontairement minimal : configuration paresseuse
// (au premier envoi) + un helper d'envoi qui remonte les endpoints morts pour que
// l'appelant puisse les purger.

let configured = false;

// Clé publique VAPID exposée AUSSI au client (NEXT_PUBLIC_) pour PushManager.
// On la relit ici pour setVapidDetails ; côté client on lit la variable NEXT_PUBLIC.
function configure() {
  if (configured) return;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  // Sujet VAPID : URL https ou mailto: identifiant l'expéditeur (requis par la
  // spec). Défaut mailto générique si non fourni.
  const subject = process.env.VAPID_SUBJECT || "mailto:contact@queue-park.com";
  if (!publicKey || !privateKey) {
    throw new Error(
      "VAPID keys missing (NEXT_PUBLIC_VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY)",
    );
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
}

export type PushTarget = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

// Charge utile lue par le service worker (public/sw.js).
export type PushPayload = {
  title: string;
  body: string;
  url: string;
  // Regroupe les notifs d'une même attraction (remplace au lieu d'empiler).
  tag?: string;
};

export type SendResult =
  | { ok: true }
  // `gone` = endpoint expiré/désabonné (404/410) : l'appelant doit le supprimer.
  | { ok: false; gone: boolean };

// Envoie un message à un abonnement. Ne lève jamais : on renvoie un statut pour
// que le moteur continue avec les autres abonnements (best-effort).
export async function sendPush(
  target: PushTarget,
  payload: PushPayload,
): Promise<SendResult> {
  configure();
  try {
    await webpush.sendNotification(
      { endpoint: target.endpoint, keys: { p256dh: target.p256dh, auth: target.auth } },
      JSON.stringify(payload),
      { TTL: 3600, urgency: "high" },
    );
    return { ok: true };
  } catch (err) {
    const status = (err as { statusCode?: number }).statusCode;
    return { ok: false, gone: status === 404 || status === 410 };
  }
}

// true si les clés VAPID sont configurées (le moteur peut s'arrêter proprement
// avec un message clair sinon).
export function isPushConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY,
  );
}
