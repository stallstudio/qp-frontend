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

// Au-delà de ce poids, l'image est REDIMENSIONNÉE avant d'être servie, elle
// n'est plus refusée.
//
// ⚠️ **Refuser était le comportement d'origine, et il a coûté des bannières
// muettes.** Les sources publient des fichiers de photographe : `Serpent Slayer`
// (Dreamworld) pèse 24,6 Mo en 8192 x 5464, Bellewaerde monte à 35,9 Mo,
// Walibi Nederland à 28,6 Mo. Un `413` ici devient un `400` à l'étage de
// l'optimiseur — dont l'amont n'a pas répondu 200 —, et la vignette disparaît
// sans que rien ne l'explique : la même URL ouverte à la main s'affiche très
// bien. Sur 249 bannières tirées au sort dans la base, trois dépassaient
// 10 Mo, soit environ 200 POI à l'échelle du catalogue, et chaque parc ajouté
// en apporte d'autres.
//
// Le worker borne déjà ce qu'il peut À LA SOURCE (`utils/poi.boundImageUrl` :
// Cloudinary, imgix, Sanity servent l'image à 1600 px). Mais les CDN qui ne
// redimensionnent pas par URL — sondés, ce sont justement Walibi et
// Bellewaerde — ne peuvent être traités qu'ici.
const TAILLE_COMPRESSION = 2 * 1024 * 1024;

// Plafond DUR, lui : au-delà, on ne télécharge même pas. Il protège la mémoire
// du serveur, ce que le seuil ci-dessus ne fait plus.
const TAILLE_MAX = 48 * 1024 * 1024;

// Largeur servie après redimensionnement. L'optimiseur de Next reprend derrière
// pour la taille réellement demandée par la page ; 1600 px lui laisse de quoi
// travailler sur un écran à haute densité.
const LARGEUR_MAX = 1600;

// ⚠️ Relevé de 8 à 20 s AVEC le redimensionnement : télécharger 30 Mo depuis un
// CDN lent dépasse allègrement huit secondes, et un délai dépassé ici est
// exactement la panne qu'on vient de corriger.
const DELAI_MS = 20000;

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

    const { corps: servi, type: typeServi } = await compresserSiBesoin(corps, type);

    return new NextResponse(servi, {
      headers: {
        "Content-Type": typeServi,
        "Content-Length": String(servi.byteLength),
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

/**
 * Ramène une image trop lourde à une taille raisonnable, format d'origine
 * conservé.
 *
 * ⚠️ **Le redimensionnement se fait à la DÉCOMPRESSION** (`resize` posé avant
 * la lecture des pixels) : libjpeg et libwebp savent décoder directement à
 * l'échelle demandée, ce qui évite de tenir un bitmap de 8192 x 5464 en mémoire
 * pour en sortir 1600 px. C'est ce qui rend l'opération tenable dans un
 * conteneur.
 *
 * ⚠️ **Jamais d'agrandissement** (`withoutEnlargement`) : une image légère mais
 * étroite ne doit pas ressortir interpolée, plus lourde qu'à l'arrivée.
 *
 * ⚠️ **Un échec n'est pas fatal** : mieux vaut servir l'original lourd que rien
 * du tout. Sharp refuse certains fichiers exotiques, et ce n'est pas une raison
 * pour faire disparaître une bannière.
 */
async function compresserSiBesoin(
  corps: Buffer<ArrayBuffer>,
  type: string,
): Promise<{ corps: Uint8Array<ArrayBuffer>; type: string }> {
  if (corps.byteLength <= TAILLE_COMPRESSION) return { corps, type };

  try {
    const { default: sharp } = await import("sharp");

    const reduit = await sharp(corps, { failOn: "none" })
      .rotate()
      .resize({ width: LARGEUR_MAX, withoutEnlargement: true })
      .jpeg({ quality: 82, mozjpeg: true })
      .toBuffer();

    // Un format déjà mieux compressé que notre JPEG (un WebP compact, par
    // exemple) ne doit pas être remplacé par plus lourd.
    if (reduit.byteLength >= corps.byteLength) return { corps, type };

    // Recopié dans un `ArrayBuffer` à lui : le `Buffer` de sharp partage le
    // pool interne de Node, que la signature de `Response` n'accepte pas.
    const octets = new Uint8Array(reduit.byteLength);
    octets.set(reduit);

    return { corps: octets, type: "image/jpeg" };
  } catch {
    return { corps, type };
  }
}
