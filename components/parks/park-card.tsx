import { Link } from "@/i18n/routing";
import { getCountryName, getParkLink, getParkStatus } from "@/lib/utils";
import TitleWithStatus from "./title-with-status";
import { ParkList } from "@/types/park";

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

  return (
    <Link
      key={park.identifier}
      href={getParkLink(park)}
      className="block group"
    >
      <div className="flex items-center gap-4 justify-between hover:bg-accent transition-colors duration-300 px-2 py-1.5 rounded-lg">
        <TitleWithStatus parkName={park.name} status={status} />
        <div className="flex items-center gap-1">
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
