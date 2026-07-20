"use client";

import { Link } from "@/i18n/routing";
import { getCountryName, getParkLink, getParkStatus } from "@/lib/utils";
import TitleWithStatus from "./title-with-status";
import { ParkList } from "@/types/api";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useFavorites } from "@/hooks/useFavorites";
import { PARK_FAVORITES_LIMIT } from "@/lib/favorites-storage";
import FavoriteStar from "@/components/ui/favorite-star";

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

export default function ParkCard({
  park,

  showBadge = true,
}: ParkCardProps) {
  const status = getParkStatus(park.openingHours);
  const searchParams = useSearchParams();
  const tFav = useTranslations("favorites");
  const { isFavorite, toggle } = useFavorites("parks");
  const isFav = isFavorite(park.identifier);

  const handleToggle = () => {
    if (!toggle(park.identifier)) {
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
          {park.badge && showBadge && (
            <div
              className={`text-xs font-bold h-4.5 flex items-center border px-1.5 rounded-sm bg-linear-to-r ${getBadgeColor(park.badge)} text-transparent bg-clip-text`}
            >
              {park.badge.toLocaleUpperCase()}
            </div>
          )}

          <div
            className={`twa twa-flag-${getCountryName(park.country).toLocaleLowerCase().replace(/\s+/g, "-")} twa-lg`}
          />
        </div>
      </div>
    </Link>
  );
}
