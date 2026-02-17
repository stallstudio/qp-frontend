"use client";

import { Park } from "@/types/park";
import { getGroupName } from "@/lib/utils";
import { Dices, Search } from "lucide-react";
import { Input } from "../ui/input";
import { useEffect, useState, useCallback } from "react";
import { ParkGroup } from "@/types/park";
import SearchResult from "./search-result";
import { useRouter } from "@/i18n/routing";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

interface SearchBarProps {
  parks: Park[];
  groups: ParkGroup[];
}

export default function SearchBar({ parks, groups }: SearchBarProps) {
  const t = useTranslations("search");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Park[]>([]);
  const router = useRouter();

  const filterParks = useCallback(
    (parksToFilter: Park[]) => {
      const query = searchQuery.toLowerCase();
      return parksToFilter
        .filter(
          (park) =>
            park.name.toLowerCase().includes(query) ||
            getGroupName(park.groupId, groups).toLowerCase().includes(query) ||
            (park.country && park.country.toLowerCase().includes(query)),
        )
        .slice(0, 6);
    },
    [searchQuery, groups],
  );

  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setSearchResults([]);
    } else {
      const filteredParks = filterParks(parks);
      setSearchResults(filteredParks);
    }
  }, [searchQuery, filterParks, parks]);

  const shouldShowResults = searchQuery.trim() && searchQuery.length >= 2;

  const getHeightClass = () => {
    console.log(searchResults.length);
    if (!shouldShowResults) {
      return "h-0";
    }
    switch (searchResults.length) {
      case 0:
        return "h-[75px]";
      case 1:
        return "h-[202px]";
      case 2:
        return "h-[364px] sm:h-[202px] md:h-[202px]";
      case 3:
        return "h-[527px] sm:h-[364px] md:h-[202px]";
      case 4:
        return "h-[688px] sm:h-[364px] md:h-[364px]";
      case 5:
        return "h-[850px] sm:h-[527px] md:h-[364px]";
      case 6:
        return "h-[1010px] sm:h-[527px] md:h-[364px]";
      default:
        return "h-0";
    }
  };

  const getRandomPark = () => {
    const randomIndex = Math.floor(Math.random() * parks.length);
    toast.success(`${t("randomParkToast")} ${parks[randomIndex].name} !`, {
      icon: <Dices className="size-4" />,
    });
    router.push(`/park/${parks[randomIndex].identifier}`);
  };
  return (
    <div>
      {/* Search Input */}
      <div className="flex items-center">
        <div className="relative bg-background rounded-4xl flex-1">
          <Input
            type="text"
            placeholder={t("placeholder")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="rounded-4xl h-12 pl-11 pe-12 truncate"
          />
          <Search className="absolute left-3.5 top-3.5 size-5 text-muted-foreground" />
          <div className="absolute top-0 right-0 h-12 w-12 rounded-4xl flex items-center justify-center border-s text-primary border-input cursor-pointer">
            <Dices className="size-5" onClick={getRandomPark} />
          </div>
        </div>
      </div>

      {/* Search Results */}
      <div
        className={`bg-input/30 border rounded-b-4xl -mt-6 mb-6 w-full z-0 transition-all duration-300 overflow-hidden ${getHeightClass()}`}
      >
        {shouldShowResults && (
          <div className="p-4 mt-5.5">
            {searchResults.length <= 0 ? (
              <p className="text-muted-foreground text-center text-sm">
                {t("noResults")}
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {searchResults.map((park, index) => (
                  <SearchResult key={index} park={park} groups={groups} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
