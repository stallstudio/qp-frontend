import webpush from "web-push";

// Envoi Web Push (VAPID) côté serveur. Utilisé par le moteur d'alertes
// (/api/cron/alerts). Volontairement minimal : configuration paresseuse
// (au premier envoi) + un helper d'envoi qui remonte les endpoints morts pour que
// l'appelant puisse les purger.

let configured = false;

/**
 * Lit une variable d'environnement À L'EXÉCUTION.
 *
 * ⚠️ **`process.env.NEXT_PUBLIC_*` est REMPLACÉ PAR SA VALEUR au `next build`,
 * bundle SERVEUR compris.** Ce qui manque au build est donc perdu pour de bon :
 * le conteneur a beau porter la variable, le code compilé ne la lit plus jamais.
 *
 * C'est exactement ce qui a mis `/api/cron/alerts` en 503 en production, avec un
 * `.env` pourtant identique à celui de `dev` : le build-arg
 * `NEXT_PUBLIC_VAPID_PUBLIC_KEY` n'était pas renseigné dans l'Environment GitHub
 * `prod`, la clé s'est inlinée vide, et le moteur d'alertes a conclu que le push
 * n'était pas configuré.
 *
 * Passer par `process.env` DÉRÉFÉRENCÉ dans une variable locale échappe au
 * remplacement statique (il ne cible que la forme littérale `process.env.X`) :
 * on retrouve la vraie variable du conteneur, quel qu'ait été le build.
 */
function runtimeEnv(name: string): string | undefined {
  const env = process.env as Record<string, string | undefined>;
  return env[name]?.trim() || undefined;
}

/**
 * Clé publique VAPID côté SERVEUR, dans l'ordre du plus fiable au moins fiable :
 * la variable du conteneur, puis `VAPID_PUBLIC_KEY` (alias facultatif, purement
 * serveur — jamais inliné, donc jamais tributaire d'un build-arg), enfin la
 * valeur inlinée au build (seul cas restant : un runtime qui ne porterait pas la
 * variable alors que le build l'avait).
 */
function readPublicKey(): string | undefined {
  return (
    runtimeEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY") ??
    runtimeEnv("VAPID_PUBLIC_KEY") ??
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim() ??
    undefined
  );
}

function readPrivateKey(): string | undefined {
  // Jamais `NEXT_PUBLIC_` : celle-ci ne doit exister qu'au runtime serveur.
  return runtimeEnv("VAPID_PRIVATE_KEY");
}

// Clé publique VAPID exposée AUSSI au client (NEXT_PUBLIC_) pour PushManager.
// On la relit ici pour setVapidDetails ; côté client on lit la variable NEXT_PUBLIC.
function configure() {
  if (configured) return;
  const publicKey = readPublicKey();
  const privateKey = readPrivateKey();
  // Sujet VAPID : URL https ou mailto: identifiant l'expéditeur (requis par la
  // spec). Défaut mailto générique si non fourni.
  const subject =
    runtimeEnv("VAPID_SUBJECT") || "mailto:contact@queue-park.com";
  if (!publicKey || !privateKey) {
    throw new Error(`VAPID keys missing (${missingPushConfig().join(", ")})`);
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

/**
 * Les variables qui manquent, pour que le refus soit DIAGNOSTIQUABLE.
 *
 * Un « VAPID keys not configured » sec ne dit pas laquelle des deux manque, et
 * envoie chercher dans le `.env` — où elles sont toutes les deux présentes, vu
 * que la publique se perd au build et non au runtime. Nommer la coupable épargne
 * la même enquête la prochaine fois.
 */
export function missingPushConfig(): string[] {
  const missing: string[] = [];
  if (!readPublicKey()) missing.push("NEXT_PUBLIC_VAPID_PUBLIC_KEY");
  if (!readPrivateKey()) missing.push("VAPID_PRIVATE_KEY");
  return missing;
}

// Clé publique VAPID servie au navigateur par `/api/push/vapid-public-key`,
// quand la valeur inlinée dans le bundle client est vide. Voir cette route.
export function getPublicKey(): string | undefined {
  return readPublicKey();
}
