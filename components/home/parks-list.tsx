import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ParkCategoryCard from "../parks/park-category-card";
import { getCountryName, getParkStatus } from "@/lib/utils";
import { useTranslations } from "next-intl";
import { ParkList } from "@/types/api";
import { Switch } from "../ui/switch";
import { Label } from "../ui/label";
import { useSearchParams, useRouter, usePathname } from "next/navigation";

interface ParksListProps {
  parks: ParkList[];
}

export default function ParksList({ parks }: ParksListProps) {
  const t = useTranslations("parksList");
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const sortBy = (searchParams.get("sort") === "country" ? "country" : "group") as "group" | "country";
  const onlyOpenParks = searchParams.get("open") === "true";

  const updateParam = (key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value === null) {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    const query = params.toString();
    router.replace(`${pathname}${query ? `?${query}` : ""}`, { scroll: false });
  };

  const handleSortByChange = (value: string) => {
    if (value === "group" || value === "country") {
      updateParam("sort", value === "group" ? null : value);
    }
  };

  const filteredParks = onlyOpenParks
    ? parks.filter((park) => getParkStatus(park.openingHours) === "open")
    : parks;

  const groupParksByGroup = () => {
    const grouped: Record<string, ParkList[]> = {};
    filteredParks.forEach((park) => {
      const groupName = park.group.name;
      if (!grouped[groupName]) {
        grouped[groupName] = [];
      }
      grouped[groupName].push(park);
    });

    // Sort groups alphabetically
    const sortedGrouped: Record<string, ParkList[]> = {};
    Object.keys(grouped)
      .sort()
      .forEach((key) => {
        sortedGrouped[key] = grouped[key];
      });

    return sortedGrouped;
  };

  const groupParksByCountry = () => {
    const grouped: Record<string, ParkList[]> = {};
    filteredParks.forEach((park) => {
      const countryName = getCountryName(park.country || "Unknown Country");
      if (!grouped[countryName]) {
        grouped[countryName] = [];
      }
      grouped[countryName].push(park);
    });

    // Sort groups alphabetically
    const sortedGrouped: Record<string, ParkList[]> = {};
    Object.keys(grouped)
      .sort()
      .forEach((key) => {
        sortedGrouped[key] = grouped[key];
      });

    return sortedGrouped;
  };

  const getGroupedParks = () => {
    return sortBy === "group" ? groupParksByGroup() : groupParksByCountry();
  };

  const splitGroupsBalanced = (numColumns: number) => {
    const grouped = getGroupedParks();
    const entries = Object.entries(grouped);

    const columns: [string, ParkList[]][][] = Array.from(
      { length: numColumns },
      () => [],
    );
    const counts = new Array(numColumns).fill(0);

    entries.forEach(([groupName, groupParks]) => {
      let minIdx = 0;
      for (let i = 1; i < numColumns; i++) {
        if (counts[i] < counts[minIdx]) minIdx = i;
      }
      columns[minIdx].push([groupName, groupParks]);
      counts[minIdx] += groupParks.length;
    });

    return columns;
  };

  const getMobileParks = () => {
    return Object.entries(getGroupedParks());
  };

  const twoColumns = splitGroupsBalanced(2);
  const threeColumns = splitGroupsBalanced(3);
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-3xl font-bold">{t("title")}</h1>
        <div className="flex items-center gap-4">
          <div className="flex items-center space-x-2">
            <Switch
              id="only-open-parks"
              onCheckedChange={(checked) => updateParam("open", checked ? "true" : null)}
              checked={onlyOpenParks}
              className="cursor-pointer"
            />
            <Label htmlFor="only-open-parks" className="cursor-pointer">
              {t("hideClosedParks")}
            </Label>
          </div>
          <Tabs value={sortBy} onValueChange={handleSortByChange}>
            <TabsList>
              <TabsTrigger value="group">{t("sortByGroup")}</TabsTrigger>
              <TabsTrigger value="country">{t("sortByCountry")}</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {/* Desktop (lg+): 3 columns */}
        {threeColumns.map((column, columnIndex) => (
          <div
            key={`lg-col-${columnIndex}`}
            className="space-y-8 hidden lg:block"
          >
            {column.map(([groupName, groupParks]) => (
              <ParkCategoryCard
                key={groupName}
                groupName={groupName}
                parks={groupParks}
              />
            ))}
          </div>
        ))}

        {/* Tablet (md only): 2 columns */}
        {twoColumns.map((column, columnIndex) => (
          <div
            key={`md-col-${columnIndex}`}
            className="space-y-8 hidden md:block lg:hidden"
          >
            {column.map(([groupName, groupParks]) => (
              <ParkCategoryCard
                key={groupName}
                groupName={groupName}
                parks={groupParks}
              />
            ))}
          </div>
        ))}

        {/* Mobile: single column */}
        <div className="space-y-8 block md:hidden">
          {getMobileParks().map(([groupName, groupParks]) => (
            <ParkCategoryCard
              key={groupName}
              groupName={groupName}
              parks={groupParks}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
