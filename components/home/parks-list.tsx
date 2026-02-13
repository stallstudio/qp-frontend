import { Park, ParkGroup } from "@/types/park";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ParkCategoryCard from "../parks/park-category-card";
import { useState } from "react";
import { getCountryName, getGroupName } from "@/lib/utils";
import { useTranslations } from "next-intl";

interface ParksListProps {
  parks: Park[];
  groups: ParkGroup[];
}

export default function ParksList({ parks, groups }: ParksListProps) {
  const t = useTranslations("parksList");
  const [sortBy, setSortBy] = useState<"group" | "country">("group");

  const handleSortByChange = (value: string) => {
    if (value === "group" || value === "country") {
      setSortBy(value);
    }
  };

  const groupParksByGroup = () => {
    const grouped: Record<string, Park[]> = {};
    parks.forEach((park) => {
      const groupName = getGroupName(park.groupId, groups);
      if (!grouped[groupName]) {
        grouped[groupName] = [];
      }
      grouped[groupName].push(park);
    });

    // Sort groups alphabetically
    const sortedGrouped: Record<string, Park[]> = {};
    Object.keys(grouped)
      .sort()
      .forEach((key) => {
        sortedGrouped[key] = grouped[key];
      });

    return sortedGrouped;
  };

  const groupParksByCountry = () => {
    const grouped: Record<string, Park[]> = {};
    parks.forEach((park) => {
      const countryName = getCountryName(park.country || "Unknown Country");
      if (!grouped[countryName]) {
        grouped[countryName] = [];
      }
      grouped[countryName].push(park);
    });

    // Sort groups alphabetically
    const sortedGrouped: Record<string, Park[]> = {};
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
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-3xl font-bold">{t("title")}</h1>
        <Tabs defaultValue="group" onValueChange={handleSortByChange}>
          <TabsList>
            <TabsTrigger value="group">{t("sortByGroup")}</TabsTrigger>
            <TabsTrigger value="country">{t("sortByCountry")}</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* First Column */}
        <div className="space-y-8">
          {Object.entries(getGroupedParks())
            .slice(0, Math.ceil(Object.entries(getGroupedParks()).length / 2))
            .map(([groupName, groupParks]) => (
              <ParkCategoryCard
                key={groupName}
                groupName={groupName}
                parks={groupParks}
              />
            ))}
        </div>

        {/* Second Column */}
        <div className="space-y-8">
          {Object.entries(getGroupedParks())
            .slice(Math.ceil(Object.entries(getGroupedParks()).length / 2))
            .map(([groupName, groupParks]) => (
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
