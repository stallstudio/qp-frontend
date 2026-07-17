import { Resend } from "resend";

// Même architecture d'envoi que l'administration (tw-waittimes-admin/lib/resend.ts) :
// instance paresseuse + adresse d'expéditeur centralisée. Les deux apps sont des
// déploiements séparés, on réplique donc le pattern plutôt que de partager le code.

let resendInstance: Resend | null = null;

export const getResend = () => {
  if (!resendInstance) {
    resendInstance = new Resend(process.env.RESEND_API_KEY);
  }
  return resendInstance;
};

// Adresse dédiée aux emails de connexion (magic link).
export const LOGIN_FROM_EMAIL = "Queue Park <login@updates.queue-park.com>";
