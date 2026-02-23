import { getParkStatusDot } from "@/lib/badge";
import { getParkStatus } from "@/lib/utils";
import { ParkList } from "@/types/park";
import Image from "next/image";
import { Link } from "@/i18n/routing";
import Flag from "react-flagkit";
import { ChevronRight } from "lucide-react";

interface SearchResultProps {
  park: ParkList;
}

export default function SearchResult({ park }: SearchResultProps) {
  const status = getParkStatus(park.openingHours);
  return (
    <Link
      href={`/park/${park.identifier}`}
      className="border rounded-2xl hover:bg-accent cursor-pointer group transition-colors duration-300"
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
            <Flag country={park.country || ""} />

            <h3 className="font-medium group-hover:text-primary line-clamp-1 transition-colors duration-300">
              {park.name}
            </h3>
            {getParkStatusDot(status)}
          </div>
          <p className="text-xs text-muted-foreground">{park.group.name}</p>
        </div>
        <ChevronRight className="size-3.5 text-muted-foreground group-hover:text-primary transition-colors duration-300" />
      </div>
    </Link>
  );
}
