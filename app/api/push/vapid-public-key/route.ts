import { NextResponse } from "next/server";
import { getPublicKey } from "@/lib/web-push";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ————————————————————————————————————————————————————————————————————————
// Clé publique VAPID, servie au NAVIGATEUR.
//
// Le client la lit normalement dans `process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY`,
// inlinée dans son bundle au `next build`. Cette route n'existe que pour le cas
// où cette valeur est VIDE : un build lancé sans le build-arg (voir le
// Dockerfile et `.github/workflows/build.yml`) produit une image où plus
// personne ne peut s'abonner aux alertes, sans le moindre message — c'est
// arrivé en production.
//
// Le serveur, lui, sait toujours lire la vraie variable du conteneur
// (`lib/web-push.ts`). Un aller-retour suffit donc à réparer l'abonnement sans
// attendre un nouveau build. Le repli ne coûte rien quand le build est correct :
// `lib/push-client.ts` n'appelle cette route que si la valeur inlinée manque.
//
// Aucun secret ici : cette clé est publique par construction (elle part dans le
// bundle navigateur et dans chaque abonnement PushManager). La privée, elle, ne
// sort jamais du serveur.
// ————————————————————————————————————————————————————————————————————————
export async function GET() {
  const key = getPublicKey();
  if (!key) {
    return NextResponse.json(
      { error: "VAPID public key not configured" },
      { status: 503 },
    );
  }
  return NextResponse.json({ key });
}
