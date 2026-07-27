import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

// Hôtes autorisés pour l'optimiseur d'images (`/_next/image`).
//
// ⚠️ Sans liste, l'optimiseur accepte N'IMPORTE QUELLE URL distante : n'importe
// qui peut faire transiter et redimensionner ses propres images par notre
// serveur (CPU + bande passante à notre charge).
//
// La liste vit ENTIÈREMENT dans `IMAGE_ALLOWED_HOSTS` (`.env`) : ajouter un CDN
// ne doit pas demander de toucher au code. Hôtes séparés par des virgules, `*.`
// accepté en préfixe.
//
// ⚠️ Elle doit couvrir TOUTES les images distantes, y compris celles qu'on ne
// choisit pas explicitement :
//   - le CDN des covers de parcs (et celui de Thrills.world) ;
//   - `lh3.googleusercontent.com` — les photos de profil Google, écrites dans
//     `user.image` par `auth.ts`. L'oublier casse tous les avatars.
//
// Un hôte mal orthographié ne provoque aucune erreur au build : les images
// concernées renvoient simplement 400 à l'exécution.
const allowedImageHosts = [
  ...new Set(
    (process.env.IMAGE_ALLOWED_HOSTS ?? "")
      .split(",")
      .map((host) => host.trim())
      .filter(Boolean),
  ),
];

// Variable absente = on ne casse aucune image, mais l'optimiseur redevient
// ouvert à tous : on le signale au démarrage plutôt que de le laisser passer
// inaperçu.
if (allowedImageHosts.length === 0 && process.env.NODE_ENV === "production") {
  console.warn(
    "[next.config] IMAGE_ALLOWED_HOSTS non défini : l'optimiseur d'images accepte tous les hôtes distants.",
  );
}

const nextConfig: NextConfig = {
  output: "standalone",
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  images: {
    remotePatterns:
      allowedImageHosts.length > 0
        ? allowedImageHosts.map((hostname) => ({
            protocol: "https" as const,
            hostname,
          }))
        : [{ protocol: "https" as const, hostname: "**" }],
    // Les covers de parcs et les avatars ne changent quasiment jamais : on garde
    // les variantes optimisées 7 jours au lieu du défaut (60 s), ce qui évite de
    // re-télécharger et ré-encoder la même image en boucle.
    minimumCacheTTL: 60 * 60 * 24 * 7,
    formats: ["image/avif", "image/webp"],
    // Aucune image SVG distante n'est attendue : les refuser ferme un vecteur
    // d'injection (un SVG peut embarquer du script).
    dangerouslyAllowSVG: false,
  },
};

export default withNextIntl(nextConfig);
