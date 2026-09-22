import { NextRequest, NextResponse } from "next/server";
import { decodeUrl, verifyImageSignature } from "@/lib/image-proxy";

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
const COMPRESSION_THRESHOLD = 2 * 1024 * 1024;

// Plafond DUR, lui : au-delà, on ne télécharge même pas. Il protège la mémoire
// du serveur, ce que le seuil ci-dessus ne fait plus.
const MAX_SIZE = 48 * 1024 * 1024;

// Largeur servie après redimensionnement. L'optimiseur de Next reprend derrière
// pour la taille réellement demandée par la page ; 1600 px lui laisse de quoi
// travailler sur un écran à haute densité.
const MAX_WIDTH = 1600;

// ⚠️ Relevé de 8 à 20 s AVEC le redimensionnement : télécharger 30 Mo depuis un
// CDN lent dépasse allègrement huit secondes, et un délai dépassé ici est
// exactement la panne qu'on vient de corriger.
const TIMEOUT_MS = 20000;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const param = searchParams.get("u");
  const sig = searchParams.get("s");

  if (!param || !sig) {
    return new NextResponse("Paramètres manquants", { status: 400 });
  }

  // ⚠️ `u` porte l'URL en base64url, pas en clair : un nom de fichier lisible
  // dans la query fait annuler la requête par les bloqueurs de publicité du
  // visiteur (voir `decodeUrl`). Le décodage précède la vérification, qui
  // porte sur l'URL décodée.
  const url = decodeUrl(param);
  if (!url) {
    return new NextResponse("Paramètre illisible", { status: 400 });
  }

  // ⚠️ La signature est vérifiée AVANT le moindre fetch : une URL fabriquée à
  // la main ne doit pas même provoquer une requête sortante, sinon la route
  // reste un scanner de réseau à la disposition de tous.
  if (!verifyImageSignature(url, sig)) {
    return new NextResponse("Signature invalide", { status: 403 });
  }

  try {
    const upstream = await fetch(url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      // Aucun en-tête du visiteur n'est transmis : ni cookie, ni Authorization.
      headers: { Accept: "image/*" },
      redirect: "follow",
    });

    if (!upstream.ok) {
      return new NextResponse("Image indisponible", { status: 404 });
    }

    const declaredType = upstream.headers.get("content-type") ?? "";

    // ⚠️ Un SVG peut embarquer du script, et servi depuis NOTRE domaine il
    // s'exécuterait dans NOTRE origine. `next.config.ts` les refuse déjà côté
    // optimiseur (`dangerouslyAllowSVG: false`) ; le refus doit être ici aussi,
    // sans quoi le proxy rouvrirait la porte que la config ferme.
    //
    // ⚠️ Refusé sur la DÉCLARATION, avant même de télécharger : c'est le seul
    // type dont le nom suffit à trancher, et le seul qu'on ne veut pas voir
    // passer par le renifleur ci-dessous.
    if (declaredType.includes("svg")) {
      return new NextResponse("Type non autorisé", { status: 415 });
    }

    const declaredLength = Number(upstream.headers.get("content-length") ?? 0);
    if (declaredLength > MAX_SIZE) {
      return new NextResponse("Image trop volumineuse", { status: 413 });
    }

    // Le corps est bufferisé plutôt que streamé : c'est le seul moyen de faire
    // respecter le plafond quand l'amont n'annonce pas de `content-length`.
    const body = Buffer.from(await upstream.arrayBuffer());
    if (body.byteLength > MAX_SIZE) {
      return new NextResponse("Image trop volumineuse", { status: 413 });
    }

    // ⚠️ **Le `content-type` de l'amont n'est PAS une autorité, et le type
    // servi est celui des OCTETS.** S'y fier a coûté des catalogues entiers :
    // mesuré le 2026-08-26 sur les 20 439 bannières de la base, quatre hôtes
    // servent de VRAIS JPEG — signature `ff d8 ff` vérifiée — sous un type
    // générique, parce que le CMS du parc a téléversé les fichiers sur S3 sans
    // métadonnée. `application/octet-stream` chez Beto Carrero (45 POI), Lotte
    // World (108) et Lotte World Busan (67), `binary/octet-stream` chez Huis
    // Ten Bosch (141). **361 POI** dont la bannière était refusée en `415` ici,
    // ce que l'optimiseur de Next traduit par un `400 « The requested resource
    // isn't a valid image »` — et le même en-tête fait TÉLÉCHARGER l'image au
    // lieu de l'afficher quand on ouvre l'URL du parc à la main, symptôme par
    // lequel on l'a vu.
    //
    // ⚠️ **Vérifier la signature est plus SÛR que croire l'en-tête, pas plus
    // laxiste.** Un SVG annoncé `image/png` passait quand le type déclaré
    // suffisait ; il ne passe plus, puisqu'un SVG est du texte et ne présente
    // aucune signature binaire. Le prix de cette sévérité a été mesuré avant
    // d'être payé : sur les 70 hôtes de la base, 63 servent une image reconnue
    // (48 JPEG, 8 PNG, 7 WebP) et les 7 autres ne servent AUCUNE image — des
    // pages d'erreur HTML ou des hôtes injoignables, déjà cassés aujourd'hui.
    // Aucune bannière qui s'affiche ne cesse donc de s'afficher.
    const type = sniffType(body);
    if (!type) {
      return new NextResponse("Type non autorisé", { status: 415 });
    }

    const { body: served, type: servedType } = await compressIfNeeded(body, type);

    return new NextResponse(served, {
      headers: {
        "Content-Type": servedType,
        "Content-Length": String(served.byteLength),
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
 * Le vrai format d'un fichier, lu dans ses premiers octets — ou `null` si ce
 * n'est pas une image que nous servons.
 *
 * ⚠️ **Liste FERMÉE, et c'est ce qui en fait un garde-fou.** Tout ce qui n'est
 * pas une de ces cinq signatures est refusé : du HTML (une page d'erreur servie
 * en 200), un PDF, et un SVG — qui est du texte et n'a donc aucune signature
 * binaire à présenter. Le renifleur ne peut pas élargir ce que la route accepte,
 * seulement reconnaître ce qu'un en-tête mal renseigné cachait.
 *
 * Les octets lus sont ceux du standard de chaque format : `ff d8 ff` pour JPEG,
 * le préambule PNG de huit octets, `GIF8`, `RIFF` + `WEBP` au huitième octet, et
 * la boîte `ftyp` d'ISO-BMFF pour AVIF et HEIC.
 */
function sniffType(body: Buffer): string | null {
  if (body.length < 12) return null;

  if (body[0] === 0xff && body[1] === 0xd8 && body[2] === 0xff) {
    return "image/jpeg";
  }
  if (body.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return "image/png";
  }
  if (body.subarray(0, 4).toString("ascii") === "GIF8") {
    return "image/gif";
  }
  if (
    body.subarray(0, 4).toString("ascii") === "RIFF" &&
    body.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "image/webp";
  }
  // ISO-BMFF : la marque de format suit la boîte `ftyp`. `avif` et `heic`
  // partagent le conteneur, `sharp` décode les deux.
  if (body.subarray(4, 8).toString("ascii") === "ftyp") {
    const brand = body.subarray(8, 12).toString("ascii");
    if (brand.startsWith("avif") || brand.startsWith("avis")) return "image/avif";
    if (brand.startsWith("heic") || brand.startsWith("heix") || brand.startsWith("mif1")) {
      return "image/heic";
    }
  }

  return null;
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
async function compressIfNeeded(
  body: Buffer<ArrayBuffer>,
  type: string,
): Promise<{ body: Uint8Array<ArrayBuffer>; type: string }> {
  if (body.byteLength <= COMPRESSION_THRESHOLD) return { body: body, type };

  try {
    const { default: sharp } = await import("sharp");

    const reduced = await sharp(body, { failOn: "none" })
      .rotate()
      .resize({ width: MAX_WIDTH, withoutEnlargement: true })
      .jpeg({ quality: 82, mozjpeg: true })
      .toBuffer();

    // Un format déjà mieux compressé que notre JPEG (un WebP compact, par
    // exemple) ne doit pas être remplacé par plus lourd.
    if (reduced.byteLength >= body.byteLength) return { body: body, type };

    // Recopié dans un `ArrayBuffer` à lui : le `Buffer` de sharp partage le
    // pool interne de Node, que la signature de `Response` n'accepte pas.
    const bytes = new Uint8Array(reduced.byteLength);
    bytes.set(reduced);

    return { body: bytes, type: "image/jpeg" };
  } catch {
    return { body: body, type };
  }
}
