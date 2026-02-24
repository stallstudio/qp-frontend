import { Link } from "@/i18n/routing";
import { getParkLink, getParkStatus } from "@/lib/utils";
import Flag from "react-flagkit";
import TitleWithStatus from "./title-with-status";
import { ParkList } from "@/types/park";

interface ParkCardProps {
  park: ParkList;
  note?: string | null;
  showBadge?: boolean;
}

const getBadgeColor = (type: string) => {
  switch (type) {
    case "new":
      return "from-green-600 to-green-300";
    case "featured":
      return "from-blue-600 to-blue-300";
    case "updated":
      return "from-yellow-600 to-yellow-300";
    default:
      return "from-yellow-600 to-yellow-300";
  }
};

export default function ParkCard({
  park,
  note,
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
        <div className="flex flex-col items-start min-w-0">
          <TitleWithStatus parkName={park.name} status={status} />
          {note && <p className="text-xs text-muted-foreground">{note}</p>}
        </div>
        <div className="flex items-center gap-1">
          {park.badge && showBadge && (
            <div
              className={`text-xs font-bold h-4.5 flex items-center border px-1.5 rounded-sm bg-linear-to-r ${getBadgeColor(park.badge)} text-transparent bg-clip-text`}
            >
              {park.badge.toLocaleUpperCase()}
            </div>
          )}
          <div className="w-6 h-4.5 border rounded-sm">
            <Flag
              country={park.country || ""}
              className="w-full h-full object-cover rounded-sm"
            />
          </div>
        </div>
      </div>
    </Link>
  );
}
