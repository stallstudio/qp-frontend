"use client";

import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { useFavorites } from "@/hooks/useFavorites";
import FavoriteStar from "@/components/ui/favorite-star";

// Lien placeholder vers Thrills (pas de deep-link par attraction pour l'instant).
const THRILLS_URL = "https://thrills.world";

// Bannière de l'attraction. Faute d'image par attraction pour l'instant, on
// affiche la bannière par défaut de Queue Park (default_cover.webp). Par-dessus,
// en bas : le nom + le lien Thrills (à gauche) et l'étoile favori (à droite,
// même traitement que l'en-tête de parc). L'étoile remplace l'ancien gros bouton
// « Ajouter aux favoris » pour compacter le popup.
export default function ImageSection({
  rideName,
  favKey,
}: {
  rideName: string;
  favKey: string;
}) {
  const t = useTranslations("attractionDetail");
  const tFav = useTranslations("favorites");
  const { isFavorite, toggle } = useFavorites("rides");
  const isFav = isFavorite(favKey);

  return (
    <div className="relative aspect-video w-full overflow-hidden bg-muted">
      {/* Bannière par défaut (provisoire, en attendant une image par attraction). */}
      <Image
        src="/default_cover.webp"
        alt={rideName}
        fill
        sizes="(max-width: 448px) 100vw, 448px"
        className="object-cover"
        priority
      />

      {/* Dégradé pour la lisibilité du texte. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-linear-to-t from-black/80 via-black/40 to-transparent" />

      {/* Étoile favori, en bas à droite de l'image (comme l'en-tête de parc). */}
      <div className="absolute right-0 bottom-0 z-10 p-3">
        <FavoriteStar
          active={isFav}
          onToggle={() => toggle(favKey)}
          label={isFav ? tFav("remove") : tFav("add")}
          size="md"
          className={`p-1.5 bg-black/25 backdrop-blur-sm hover:bg-black/35 ${
            isFav ? "text-amber-400" : "text-white/90 hover:text-white"
          }`}
        />
      </div>

      {/* Aligné à gauche, même mise en forme que l'en-tête d'un parc
          (components/parks/header.tsx) : nom en gras, à gauche. Taille plus
          contenue que l'en-tête de parc (le popup est plus petit). `pr-16` évite
          le chevauchement avec l'étoile. */}
      <div className="absolute inset-x-0 bottom-0 flex flex-col items-start gap-1 px-5 pr-16 pb-4 text-left">
        <p className="text-xl font-bold text-white line-clamp-2 drop-shadow-sm">
          {rideName}
        </p>
        <a
          href={THRILLS_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sm font-medium text-white/90 transition-colors hover:text-white"
        >
          {t("thrillsLink")}
          <ArrowRight className="size-3.5" />
        </a>
      </div>
    </div>
  );
}
