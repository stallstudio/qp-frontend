"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { useFavorites } from "@/hooks/useFavorites";
import FavoriteStar from "@/components/ui/favorite-star";

const DEFAULT_COVER = "/default_cover.webp";

// Bannière d'en-tête RÉUTILISABLE pour les popups détail (attraction ET
// spectacle). Quand la source du parc en publie une, c'est ELLE qui s'affiche ;
// sinon la bannière par défaut de Queue Park (default_cover.webp). Par-dessus,
// en bas : le titre (+ lien externe optionnel, ex. Thrills) à gauche et l'étoile
// favori à droite.
//
// `favNamespace` isole la liste de favoris ("rides" | "shows"), `favKey` est la
// clé (ex. "{parkIdentifier}:{rideId}" ou "{parkIdentifier}:{showName}").
export default function ImageSection({
  title,
  favNamespace,
  favKey,
  link,
  subtitle,
  banner,
  credit,
}: {
  title: string;
  favNamespace: "rides" | "shows";
  favKey: string;
  link?: { url: string; label: string };
  // Sous-titre optionnel sous le nom (ex. durée d'un spectacle).
  subtitle?: string;
  // Chemin LOCAL signé vers l'image du parc (voir `lib/image-proxy.ts`), ou
  // `null` quand la source n'en publie pas.
  banner?: string | null;
  // Nom du parc, affiché en crédit — et SEULEMENT quand sa bannière s'affiche.
  credit?: string | null;
}) {
  const tFav = useTranslations("favorites");
  const { isFavorite, toggle } = useFavorites(favNamespace);
  const isFav = isFavorite(favKey);

  // ⚠️ Une bannière peut disparaître sans prévenir : le CMS d'un parc supprime
  // une photo, le proxy expire, l'hôte tombe. On retombe alors sur l'image par
  // défaut plutôt que de laisser un cadre vide — et le crédit disparaît AVEC
  // elle, puisqu'il n'y a plus rien à créditer.
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [banner]);

  const showBanner = Boolean(banner) && !failed;

  return (
    <div className="relative aspect-video w-full overflow-hidden bg-muted">
      <Image
        src={showBanner ? banner! : DEFAULT_COVER}
        alt={title}
        fill
        sizes="(max-width: 448px) 100vw, 448px"
        className="object-cover"
        onError={() => setFailed(true)}
        priority
      />

      {/* Crédit : l'image vient de l'API du parc, jamais de nous. Même
          emplacement et même mise en forme que le crédit d'une bannière de parc
          (`components/parks/cover-image.tsx`).

          ⚠️ Rien à créditer quand c'est notre image par défaut qui s'affiche —
          d'où `showBanner` et non `credit` seul. */}
      {showBanner && credit && (
        <div className="absolute top-3 right-4 z-50">
          <span className="text-[10px] text-white/60">© {credit}</span>
        </div>
      )}

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

      {/* Aligné à gauche, même mise en forme que l'en-tête d'un parc. `pr-16`
          évite le chevauchement avec l'étoile. */}
      <div className="absolute inset-x-0 bottom-0 flex flex-col items-start gap-1 px-5 pr-16 pb-4 text-left">
        <p className="text-xl font-bold text-white line-clamp-2 drop-shadow-sm">
          {title}
        </p>
        {subtitle && (
          <p className="text-sm font-medium text-white/90 drop-shadow-sm">
            {subtitle}
          </p>
        )}
        {link && (
          <a
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm font-medium text-white/90 transition-colors hover:text-white"
          >
            {link.label}
            <ArrowRight className="size-3.5" />
          </a>
        )}
      </div>
    </div>
  );
}
