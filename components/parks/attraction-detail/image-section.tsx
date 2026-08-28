"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { ArrowRight, Loader2 } from "lucide-react";
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
//
// ⚠️ **Les deux sont OPTIONNELS, et leur absence retire l'étoile.** Le popup des
// POI qui ne sont ni attraction ni spectacle (restaurants, boutiques…) réutilise
// cet en-tête, mais les favoris sont persistés PAR NAMESPACE sur le compte de
// l'utilisateur (`FavNamespace`, plafonds compris) : leur en inventer un
// troisième pour ce popup, ce serait ouvrir une liste que rien ne lit, ni
// l'espace compte ni les rappels. Le jour où ces POI méritent d'être mis en
// favori, c'est le namespace qu'il faudra créer — pas ce composant qu'il faudra
// détourner.
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
  favNamespace?: "rides" | "shows";
  favKey?: string;
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
  // ⚠️ Le hook est appelé SANS CONDITION (règle des hooks) : c'est le RENDU de
  // l'étoile qui est conditionnel, plus bas. `"rides"` n'est ici qu'un
  // namespace de repli inerte — rien n'est lu ni écrit sans `favKey`.
  const { isFavorite, toggle } = useFavorites(favNamespace ?? "rides");
  const showFavorite = favNamespace !== undefined && favKey !== undefined;
  const isFav = showFavorite && isFavorite(favKey);

  // ⚠️ Une bannière peut disparaître sans prévenir : le CMS d'un parc supprime
  // une photo, le proxy expire, l'hôte tombe. On retombe alors sur l'image par
  // défaut plutôt que de laisser un cadre vide — et le crédit disparaît AVEC
  // elle, puisqu'il n'y a plus rien à créditer.
  const [failed, setFailed] = useState(false);
  // Les bannières sont servies par les parcs eux-mêmes : selon l'hôte, elles
  // arrivent en 100 ms ou en 5 s. Tant que l'image n'est pas décodée, on couvre
  // le cadre d'un skeleton + spinner plutôt que de laisser un vide.
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    setFailed(false);
    setLoaded(false);
  }, [banner]);

  const showBanner = Boolean(banner) && !failed;
  // Uniquement pour la bannière du parc : l'image par défaut est locale, elle
  // est là tout de suite et n'a rien à faire patienter.
  const showLoader = showBanner && !loaded;

  return (
    <div className="relative aspect-video w-full overflow-hidden bg-muted">
      <Image
        src={showBanner ? banner! : DEFAULT_COVER}
        alt={title}
        fill
        sizes="(max-width: 448px) 100vw, 448px"
        className={`object-cover transition-opacity duration-500 ease-out ${
          showLoader ? "opacity-0" : "opacity-100"
        }`}
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
        priority
      />

      {/* Skeleton + spinner, en fondu croisé avec l'image (l'overlay reste monté
          le temps de la transition, d'où l'opacité plutôt qu'un démontage sec).
          Le pulse est sur une couche INTERNE : `animate-pulse` anime lui aussi
          l'opacité et écraserait la transition du parent. Pas de `z-index` — la
          position dans le DOM suffit à le placer au-dessus de l'image et sous le
          dégradé, le titre et l'étoile. */}
      {showBanner && (
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute inset-0 grid place-items-center transition-opacity duration-500 ease-out ${
            loaded ? "opacity-0" : "opacity-100"
          }`}
        >
          <div className="absolute inset-0 animate-pulse bg-muted-foreground/10" />
          <Loader2 className="relative size-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Crédit : l'image vient de l'API du parc, jamais de nous. Même mise en
          forme que le crédit d'une bannière de parc
          (`components/parks/cover-image.tsx`).

          ⚠️ Rien à créditer quand c'est notre image par défaut qui s'affiche —
          d'où `showBanner` et non `credit` seul. Il arrive en même temps que
          l'image : sur le skeleton clair, ce blanc translucide serait invisible.

          ⚠️⚠️ **`pointer-events-none`, et ce n'est pas une précaution.** Ce bloc
          était posé en `top-3 right-4 z-50`, c'est-à-dire PILE sur la croix de
          fermeture du dialogue (`top-4 right-4` dans `components/ui/dialog.tsx`),
          et au-dessus d'elle. Un texte décoratif volait donc les clics du seul
          bouton qui referme le popup — au doigt comme à la souris. Un crédit ne
          doit JAMAIS être une cible : c'est vrai ici, ce le restera où qu'on le
          déplace.

          ⚠️ `right-12` et non `right-4` : la croix occupe les 32 premiers pixels
          depuis le bord. Le `pointer-events-none` suffirait à débloquer le clic,
          mais le crédit resterait illisible SOUS la croix.

          ⚠️ **Même BOÎTE que la croix, pas un décalage à la main** : `top-4` +
          `h-4` + `items-center`, exactement les `top-4` et `size-4` du bouton de
          `dialog.tsx`. Les deux centres tombent donc sur la même ligne, et ils y
          restent si la taille du texte change — un `top-3` calé à l'œil se
          désalignait de 5 px, et se serait désaligné autrement au premier
          ajustement. */}
      {showBanner && credit && (
        <div
          className={`pointer-events-none absolute top-4 right-12 z-10 flex h-4 items-center transition-opacity duration-500 ease-out ${
            loaded ? "opacity-100" : "opacity-0"
          }`}
        >
          <span className="text-[10px] leading-none text-white/60">
            © {credit}
          </span>
        </div>
      )}

      {/* Dégradé pour la lisibilité du texte. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-linear-to-t from-black/80 via-black/40 to-transparent" />

      {/* Étoile favori, en bas à droite de l'image (comme l'en-tête de parc). */}
      {showFavorite && (
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
      )}

      {/* Aligné à gauche, même mise en forme que l'en-tête d'un parc. `pr-16`
          réserve la place de l'étoile — et seulement quand il y en a une, sinon
          le titre s'arrêterait à 64 px d'un bord vide. */}
      <div
        className={`absolute inset-x-0 bottom-0 flex flex-col items-start gap-1 px-5 pb-4 text-left ${
          showFavorite ? "pr-16" : "pr-5"
        }`}
      >
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
