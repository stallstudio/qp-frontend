import { NextRequest, NextResponse } from "next/server";
import { verifyImageSignature } from "@/lib/image-proxy";

/**
 * Sert une image distante SIGNÉE par nous, sur notre domaine.
 *
 * Voir `lib/image-proxy.ts` pour le pourquoi. En deux mots : les bannières
 * viennent de l'API de chaque parc, et déclarer chaque hôte dans
 * `next.config.ts` produirait une liste qui se périme à chaque nouveau parc.
 *
 * ⚠️ **L'optimiseur de Next se place DEVANT cette route**, pas derrière : le
 * `<Image>` demande `/_next/image?url=/api/image?...`, Next appelle cette route
 * une fois, redimensionne, puis garde le résultat 7 jours
 * (`minimumCacheTTL`). Le parc n'est donc sollicité qu'une fois par variante,
 * pas à chaque visiteur.
 */

// Une bannière de parc pèse quelques centaines de kilo-octets ; au-delà de 10 Mo
// ce n'est plus une bannière, et rien ne justifie de le faire transiter.
const TAILLE_MAX = 10 * 1024 * 1024;
const DELAI_MS = 8000;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get("u");
  const sig = searchParams.get("s");

  if (!url || !sig) {
    return new NextResponse("Paramètres manquants", { status: 400 });
  }

  // ⚠️ La signature est vérifiée AVANT le moindre fetch : une URL fabriquée à
  // la main ne doit pas même provoquer une requête sortante, sinon la route
  // reste un scanner de réseau à la disposition de tous.
  if (!verifyImageSignature(url, sig)) {
    return new NextResponse("Signature invalide", { status: 403 });
  }

  try {
    const amont = await fetch(url, {
      signal: AbortSignal.timeout(DELAI_MS),
      // Aucun en-tête du visiteur n'est transmis : ni cookie, ni Authorization.
      headers: { Accept: "image/*" },
      redirect: "follow",
    });

    if (!amont.ok) {
      return new NextResponse("Image indisponible", { status: 404 });
    }

    const type = amont.headers.get("content-type") ?? "";

    // ⚠️ Un SVG peut embarquer du script, et servi depuis NOTRE domaine il
    // s'exécuterait dans NOTRE origine. `next.config.ts` les refuse déjà côté
    // optimiseur (`dangerouslyAllowSVG: false`) ; le refus doit être ici aussi,
    // sans quoi le proxy rouvrirait la porte que la config ferme.
    if (!type.startsWith("image/") || type.includes("svg")) {
      return new NextResponse("Type non autorisé", { status: 415 });
    }

    const annonce = Number(amont.headers.get("content-length") ?? 0);
    if (annonce > TAILLE_MAX) {
      return new NextResponse("Image trop volumineuse", { status: 413 });
    }

    // Le corps est bufferisé plutôt que streamé : c'est le seul moyen de faire
    // respecter le plafond quand l'amont n'annonce pas de `content-length`.
    const corps = Buffer.from(await amont.arrayBuffer());
    if (corps.byteLength > TAILLE_MAX) {
      return new NextResponse("Image trop volumineuse", { status: 413 });
    }

    return new NextResponse(corps, {
      headers: {
        "Content-Type": type,
        "Content-Length": String(corps.byteLength),
        // Une URL signée désigne une image immuable : son contenu change, son
        // URL change. Un an de cache, sans revalidation.
        "Cache-Control": "public, max-age=31536000, immutable",
        // Le contenu vient d'un tiers : interdire au navigateur de deviner un
        // type plus permissif que celui qu'on a validé.
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    // Délai dépassé, DNS mort, certificat invalide : l'appelant retombera sur
    // l'image par défaut. Rien à journaliser, une source de parc qui tombe est
    // un événement ordinaire.
    return new NextResponse("Image injoignable", { status: 502 });
  }
}
