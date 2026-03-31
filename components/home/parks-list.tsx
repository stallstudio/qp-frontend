import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ParkCategoryCard from "../parks/park-category-card";
import { useState } from "react";
import { getCountryName, getParkStatus } from "@/lib/utils";
import { useTranslations } from "next-intl";
import { ParkList } from "@/types/api";
import { Switch } from "../ui/switch";
import { Label } from "../ui/label";

interface ParksListProps {
  parks: ParkList[];
}

export default function ParksList({ parks }: ParksListProps) {
  const t = useTranslations("parksList");
  const [sortBy, setSortBy] = useState<"group" | "country">("group");
  const [onlyOpenParks, setOnlyOpenParks] = useState<boolean>(false);

  const handleSortByChange = (value: string) => {
    if (value === "group" || value === "country") {
      setSortBy(value);
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

  const splitGroupsBalanced = () => {
    const grouped = getGroupedParks();
    const entries = Object.entries(grouped);

    let leftColumn: [string, ParkList[]][] = [];
    let rightColumn: [string, ParkList[]][] = [];
    let leftCount = 0;
    let rightCount = 0;

    entries.forEach(([groupName, groupParks]) => {
      if (leftCount <= rightCount) {
        leftColumn.push([groupName, groupParks]);
        leftCount += groupParks.length;
      } else {
        rightColumn.push([groupName, groupParks]);
        rightCount += groupParks.length;
      }
    });

    return { leftColumn, rightColumn };
  };

  const getMobileParks = () => {
    return Object.entries(getGroupedParks());
  };
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-3xl font-bold">{t("title")}</h1>
        <div className="flex items-center gap-4">
          <div className="flex items-center space-x-2">
            <Switch
              id="only-open-parks"
              onCheckedChange={setOnlyOpenParks}
              checked={onlyOpenParks}
              className="cursor-pointer"
            />
            <Label htmlFor="only-open-parks" className="cursor-pointer">
              {t("hideClosedParks")}
            </Label>
          </div>
          <Tabs defaultValue="group" onValueChange={handleSortByChange}>
            <TabsList>
              <TabsTrigger value="group">{t("sortByGroup")}</TabsTrigger>
              <TabsTrigger value="country">{t("sortByCountry")}</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* First Column */}
        <div className="space-y-8 hidden md:block">
          {splitGroupsBalanced().leftColumn.map(([groupName, groupParks]) => (
            <ParkCategoryCard
              key={groupName}
              groupName={groupName}
              parks={groupParks}
            />
          ))}
        </div>

        {/* Second Column */}
        <div className="space-y-8 hidden md:block">
          {splitGroupsBalanced().rightColumn.map(([groupName, groupParks]) => (
            <ParkCategoryCard
              key={groupName}
              groupName={groupName}
              parks={groupParks}
            />
          ))}
        </div>
        {/* Not splitted on mobile */}
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
