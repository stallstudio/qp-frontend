import { getParkLink, getParkStatus } from "@/lib/utils";
import { ParkList, CoverImage } from "@/types/api";
import Image from "next/image";
import { Link } from "@/i18n/routing";
import Flag from "react-flagkit";
import TitleWithStatus from "../parks/title-with-status";

interface SearchResultProps {
  park: ParkList;
}

export default function SearchResult({ park }: SearchResultProps) {
  const status = getParkStatus(park.openingHours);

  const getParkCover = (covers: CoverImage[]) => {
    if (covers && covers.length > 0 && covers[0].url !== "") {
      return covers[0].url;
    }
    return "/default_cover.webp";
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
        <div className="flex flex-col min-w-0">
          <TitleWithStatus
            parkName={park.name}
            status={status}
            className="truncate"
          />
          <p className="text-xs text-muted-foreground ">{park.group.name}</p>
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
