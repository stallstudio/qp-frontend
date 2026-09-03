// Régénère `public/apple-touch-icon.png` à partir du logo.
//
//   node scripts/generate-apple-icon.mjs
//
// À relancer si le logo change. `sharp` est déjà installé (dépendance de Next
// pour l'optimiseur d'images), rien à ajouter.
//
// ⚠️ Pourquoi ce fichier ne peut PAS être le logo tel quel : iOS compose la
// transparence sur du NOIR, pas sur du blanc. Le logo — un disque corail sur
// fond transparent — se retrouvait donc dans un carré noir sur l'écran
// d'accueil. `apple-touch-icon` doit être OPAQUE, d'où le fond peint ici.
//
// À ne pas confondre avec les icônes du manifeste
// (`app/[locale]/manifest.webmanifest/route.ts`) : celles-là restent en
// `purpose: "any"`, fond transparent, et ne doivent PAS passer en `maskable`.
import sharp from "sharp";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PUBLIC = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "public",
);
const SOURCE = path.join(PUBLIC, "web-app-manifest-512x512.png");

const SIZE = 180; // taille de référence d'un apple-touch-icon
// Le masque iOS est un rectangle arrondi peu agressif : pas besoin de la zone de
// sécurité à 80 % qu'exigent les icônes maskables d'Android.
const RATIO = 0.88;

// Dégradé diagonal repris des couleurs ÉCHANTILLONNÉES dans le logo : le corail
// du disque assombri d'un cran vers le rouge du wagon. Le corail pur est
// volontairement écarté — c'est la couleur du disque, un fond corail le rendrait
// invisible.
const FROM = "#c75138";
const TO = "#640606";

const background = Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${FROM}"/>
      <stop offset="100%" stop-color="${TO}"/>
    </linearGradient>
  </defs>
  <rect width="${SIZE}" height="${SIZE}" fill="url(#g)"/>
</svg>`);

const inner = Math.round(SIZE * RATIO);
const logo = await sharp(SOURCE)
  .resize(inner, inner, {
    fit: "contain",
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  })
  .toBuffer();

const out = path.join(PUBLIC, "apple-touch-icon.png");
await sharp(background)
  .composite([{ input: logo, gravity: "centre" }])
  // `removeAlpha` : garantit un PNG sans couche alpha du tout, la seule forme
  // dont iOS ne puisse rien faire de surprenant.
  .removeAlpha()
  .png()
  .toFile(out);

console.log("écrit", path.relative(process.cwd(), out));
