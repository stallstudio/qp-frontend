import { getParkStatusDot } from "@/lib/badge";
import { getGroupName, getParkStatus } from "@/lib/utils";
import { Park, ParkGroup } from "@/types/park";
import Image from "next/image";
import { Link } from "@/i18n/routing";
import Flag from "../home/flag";
import { ChevronRight } from "lucide-react";

interface SearchResultProps {
  park: Park;
  groups: ParkGroup[];
}

export default function SearchResult({ park, groups }: SearchResultProps) {
  const status = getParkStatus(park.openingHours);
  return (
    <Link
      href={`/park/${park.identifier}`}
      className="border rounded-2xl hover:bg-accent cursor-pointer group"
      key={park.id}
    >
      <Image
        src={park.cover[0]}
        alt={park.name}
        height={500}
        width={500}
        className="h-22 w-full object-cover rounded-t-lg"
      />
      <div className="flex items-center justify-between p-2">
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <Flag code={park.country || ""} />

            <h3 className="font-medium group-hover:text-primary line-clamp-1">
              {park.name}
            </h3>
            {getParkStatusDot(status)}
          </div>
          <p className="text-xs text-muted-foreground">
            {getGroupName(park.groupId, groups)}
          </p>
        </div>
        <ChevronRight className="size-3.5 text-muted-foreground" />
      </div>
    </Link>
  );
}
