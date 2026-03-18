import { getParkLink, getParkStatus } from "@/lib/utils";
import { ParkList } from "@/types/park";
import Image from "next/image";
import { Link } from "@/i18n/routing";
import Flag from "react-flagkit";
import TitleWithStatus from "../parks/title-with-status";

interface SearchResultProps {
  park: ParkList;
}

export default function SearchResult({ park }: SearchResultProps) {
  const status = getParkStatus(park.openingHours);

  const getParkCover = (covers: string[]) => {
    let cover = "/default_cover.webp";
    if (covers.length > 0) {
      if (cover[0] !== "") {
        cover = covers[0];
      }
    }
    return cover || "";
  };
  return (
    <Link
      href={getParkLink(park)}
      className="border rounded-2xl hover:bg-accent cursor-pointer group transition-colors duration-300"
    >
      <Image
        src={getParkCover(park.cover)}
        alt={park.name}
        height={500}
        width={500}
        className="h-22 w-full object-cover rounded-t-lg"
      />
      <div className="flex items-center justify-between p-2">
        <div className="flex flex-col">
          <TitleWithStatus
            parkName={park.name}
            status={status}
            className="line-clamp-1"
          />
          <p className="text-xs text-muted-foreground line-clamp-1">
            {park.group.name}
          </p>
        </div>
        <div className="w-6 h-4.5 border rounded-sm">
          <Flag
            country={park.country || ""}
            className="w-full h-full object-cover rounded-sm"
          />
        </div>
      </div>
    </Link>
  );
}
