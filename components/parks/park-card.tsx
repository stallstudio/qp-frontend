"use client";

import { Link } from "@/i18n/routing";
import { getCountryFlagClass, getParkLink, getParkStatus } from "@/lib/utils";
import TitleWithStatus from "./title-with-status";
import { ParkList } from "@/types/api";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useFavorites } from "@/hooks/useFavorites";
import { useUser } from "@/components/providers/user-provider";
import { PARK_FAVORITES_LIMIT } from "@/lib/favorites-storage";
import FavoriteStar from "@/components/ui/favorite-star";
import { AnimatedGradientText } from "@/components/ui/animated-gradient-text";

interface ParkCardProps {
  park: ParkList;
  className?: string;
  showBadge?: boolean;
}

const getBadgeColor = (type: string) => {
  switch (type) {
    case "new":
      return "from-green-600 to-green-400";
    case "featured":
      return "from-blue-600 to-blue-400";
    case "updated":
      return "from-yellow-600 to-yellow-400";
    default:
      return "from-yellow-600 to-yellow-400";
  }
};

// « Exclusif » ne dit pas la même chose que NEW / FEATURED / UPDATED, qui
// datent le parc : il dit que ce parc n'est suivi QUE chez nous. C'est un
// argument, pas une étiquette de fraîcheur — d'où le traitement à part,
// dégradé qui défile plutôt qu'une quatrième couleur fixe. Dans une liste où
// deux cents lignes se ressemblent, seul le MOUVEMENT accroche l'œil ;
// une couleur de plus se serait fondue dans les trois autres.
const EXCLUSIVE_BADGE = "exclusive";

// ⚠️ Libellé NON traduit, comme NEW / FEATURED / UPDATED : les badges sont
// identiques dans les 14 langues, et en faire l'exception aurait suffi à casser
// cette règle. Une version traduite (namespace `parkBadge`) a été écrite puis
// retirée — ne pas la réintroduire pour ce seul badge.
//
// Il ne peut pas non plus venir de la base comme les trois autres : celle-ci
// stocke la clé `exclusive`, dont la mise en majuscules donnerait « EXCLUSIVE ».
const EXCLUSIVE_LABEL = "EXCLU";

// Durée d'un balayage. Les 8 s par défaut de `--animate-gradient` sont calées
// pour un titre de héros ; sur une étiquette de cinq lettres perdue dans une
// liste, un passage toutes les huit secondes se rate simplement.
//
// ⚠️ C'est le SEUL réglage qui change la cadence — le prop `speed` élargit le
// dégradé (bande plus rapide) mais laisse toujours un balayage par cycle,
// `--bg-size` servant à la fois de largeur de motif et de distance parcourue.
// ⚠️ La même valeur est reprise dans `park-badge.tsx` de tw-waittimes-admin,
// qui montre le badge tel qu'il sera : les deux doivent bouger ensemble.
const EXCLUSIVE_SWEEP_SECONDS = 3;

export default function ParkCard({
  park,

  showBadge = true,
}: ParkCardProps) {
  const status = getParkStatus(park.openingHours);
  const searchParams = useSearchParams();
  const tFav = useTranslations("favorites");
  const { isFavorite, toggle } = useFavorites("parks");
  const { isAuthenticated } = useUser();
  const isFav = isFavorite(park.identifier);
  const flagClass = getCountryFlagClass(park.country);

  const handleToggle = async () => {
    // toggle() renvoie false aussi bien si l'utilisateur n'est pas connecté (le
    // garde a déjà ouvert le modal) que si le plafond est atteint : on ne montre
    // le toast « plafond » que dans ce dernier cas (connecté).
    if (!(await toggle(park.identifier)) && isAuthenticated) {
      toast.error(tFav("parkLimit", { max: PARK_FAVORITES_LIMIT }));
    }
  };

  const parkHref = (() => {
    const base = getParkLink(park);
    const back = searchParams.toString();
    return back ? `${base}?back=${encodeURIComponent(back)}` : base;
  })();

  return (
    <Link
      key={park.identifier}
      href={parkHref}
      className="block group h-full"
    >
      <div className="group flex items-center gap-4 justify-between hover:bg-accent transition-colors duration-300 px-2 py-1.5 rounded-lg h-full">
        <TitleWithStatus parkName={park.name} status={status} />
        <div className="flex items-center gap-1.5">
          <FavoriteStar
            active={isFav}
            onToggle={handleToggle}
            label={isFav ? tFav("removePark") : tFav("addPark")}
            className={`transition-opacity ${
              isFav
                ? "opacity-100"
                : "opacity-40 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
            }`}
          />
          {park.badge && showBadge && park.badge !== EXCLUSIVE_BADGE && (
            <div
              className={`text-xs font-bold h-4.5 flex items-center border px-1.5 rounded-sm bg-linear-to-r ${getBadgeColor(park.badge)} text-transparent bg-clip-text`}
            >
              {park.badge.toLocaleUpperCase()}
            </div>
          )}
          {park.badge === EXCLUSIVE_BADGE && showBadge && (
            <div className="text-xs font-bold h-4.5 flex items-center border border-amber-400/60 px-1.5 rounded-sm">
              {/* `motion-reduce:animate-none` : le réglage système coupe le
                  défilement sans effacer le badge — l'information reste, c'est
                  seulement l'appel du regard qui disparaît. */}
              <AnimatedGradientText
                colorFrom="#f59e0b"
                colorTo="#fde68a"
                duration={EXCLUSIVE_SWEEP_SECONDS}
                className="motion-reduce:animate-none"
              >
                {EXCLUSIVE_LABEL}
              </AnimatedGradientText>
            </div>
          )}

          {/* Le drapeau vient du CODE ISO, pas du nom anglais du pays : voir
              `getCountryFlagClass`. Rien ne s'affiche pour un code sans
              drapeau, plutôt qu'un carré vide. */}
          {flagClass && <div className={flagClass} />}
        </div>
      </div>
    </Link>
  );
}
