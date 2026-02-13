import { getParkStatusDot } from "@/lib/badge";
import { Link } from "@/i18n/routing";
import Flag from "../home/flag";
import { Park } from "@/types/park";
import { getParkStatus } from "@/lib/utils";
import { Badge } from "../ui/badge";
import { ChevronRight } from "lucide-react";

interface ParkCardProps {
  park: Park;
  note?: string | null;
  showBadge?: boolean;
}

export default function ParkCard({
  park,
  note,
  showBadge = true,
}: ParkCardProps) {
  const status = getParkStatus(park.openingHours);

  return (
    <Link
      key={park.id}
      href={`/park/${park.identifier}`}
      className="block group"
    >
      <div className="flex items-center gap-2 justify-between hover:bg-accent transition-colors duration-300 px-2 py-1.5 rounded-lg">
        <div className="flex flex-col items-start">
          <div className="flex items-center gap-2">
            <Flag code={park.country || ""} />

            <h3 className="font-medium group-hover:text-primary transition-colors duration-300">
              {park.name}
            </h3>
            {getParkStatusDot(status)}
          </div>
          {note && <p className="text-xs text-muted-foreground">{note}</p>}
        </div>
        <div className="flex items-center gap-1">
          {park.badge && showBadge && (
            <Badge>{park.badge.toLocaleUpperCase()}</Badge>
          )}
          <ChevronRight className="size-3.5 text-muted-foreground group-hover:text-primary transition-colors duration-300" />
        </div>
      </div>
    </Link>
  );
}
