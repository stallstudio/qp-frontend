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

    const declare = amont.headers.get("content-type") ?? "";

    // ⚠️ Un SVG peut embarquer du script, et servi depuis NOTRE domaine il
    // s'exécuterait dans NOTRE origine. `next.config.ts` les refuse déjà côté
    // optimiseur (`dangerouslyAllowSVG: false`) ; le refus doit être ici aussi,
    // sans quoi le proxy rouvrirait la porte que la config ferme.
    //
    // ⚠️ Refusé sur la DÉCLARATION, avant même de télécharger : c'est le seul
    // type dont le nom suffit à trancher, et le seul qu'on ne veut pas voir
    // passer par le renifleur ci-dessous.
    if (declare.includes("svg")) {
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
    const type = typeReniffle(corps);
    if (!type) {
      return new NextResponse("Type non autorisé", { status: 415 });
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
function typeReniffle(corps: Buffer): string | null {
  if (corps.length < 12) return null;

  if (corps[0] === 0xff && corps[1] === 0xd8 && corps[2] === 0xff) {
    return "image/jpeg";
  }
  if (corps.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return "image/png";
  }
  if (corps.subarray(0, 4).toString("ascii") === "GIF8") {
    return "image/gif";
  }
  if (
    corps.subarray(0, 4).toString("ascii") === "RIFF" &&
    corps.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "image/webp";
  }
  // ISO-BMFF : la marque de format suit la boîte `ftyp`. `avif` et `heic`
  // partagent le conteneur, `sharp` décode les deux.
  if (corps.subarray(4, 8).toString("ascii") === "ftyp") {
    const marque = corps.subarray(8, 12).toString("ascii");
    if (marque.startsWith("avif") || marque.startsWith("avis")) return "image/avif";
    if (marque.startsWith("heic") || marque.startsWith("heix") || marque.startsWith("mif1")) {
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
