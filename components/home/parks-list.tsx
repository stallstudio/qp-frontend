import { AnimatePresence, motion } from "motion/react";
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
              className="cursor-pointer [&_[data-slot=switch-thumb]]:duration-[400ms] [&_[data-slot=switch-thumb]]:ease-[cubic-bezier(0.32,0.72,0,1)]"
            />
            <Label htmlFor="only-open-parks" className="cursor-pointer">
              {t("hideClosedParks")}
            </Label>
          </div>
          <Tabs value={sortBy} onValueChange={handleSortByChange}>
            {/* Deux cellules égales (grid-cols-2) pour que la pastille à 50%
                tombe juste malgré des libellés de longueurs différentes. */}
            <TabsList className="relative grid grid-cols-2 overflow-hidden">
              <span
                aria-hidden
                className="pointer-events-none absolute top-[3px] bottom-[3px] left-[3px] w-[calc(50%-3px)] rounded-md bg-background shadow-sm dark:bg-input/30 dark:border dark:border-input"
                style={{
                  transform:
                    sortBy === "country"
                      ? "translateX(100%)"
                      : "translateX(0%)",
                  transitionProperty: "transform",
                  transitionDuration: "500ms",
                  transitionTimingFunction: "cubic-bezier(0.32, 0.72, 0, 1)",
                }}
              />
              <TabsTrigger
                value="group"
                className="relative z-10 w-full data-[state=active]:bg-transparent data-[state=active]:shadow-none dark:data-[state=active]:bg-transparent dark:data-[state=active]:border-transparent"
              >
                {t("sortByGroup")}
              </TabsTrigger>
              <TabsTrigger
                value="country"
                className="relative z-10 w-full data-[state=active]:bg-transparent data-[state=active]:shadow-none dark:data-[state=active]:bg-transparent dark:data-[state=active]:border-transparent"
              >
                {t("sortByCountry")}
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* `layout` sur la grille + AnimatePresence dans chaque colonne : filtrer
          (masquer les fermés) ou changer de tri (groupe/pays) fait glisser,
          apparaître et disparaître les catégories en douceur au lieu de sauter. */}
      <motion.div
        layout
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
      >
        {/* Desktop (lg+): 3 columns */}
        {threeColumns.map((column, columnIndex) => (
          <motion.div
            layout
            key={`lg-col-${columnIndex}`}
            className="space-y-8 hidden lg:block"
          >
            <AnimatePresence initial={false}>
              {column.map(([groupName, groupParks]) => (
                <ParkCategoryCard
                  key={groupName}
                  groupName={groupName}
                  parks={groupParks}
                />
              ))}
            </AnimatePresence>
          </motion.div>
        ))}

        {/* Tablet (md only): 2 columns */}
        {twoColumns.map((column, columnIndex) => (
          <motion.div
            layout
            key={`md-col-${columnIndex}`}
            className="space-y-8 hidden md:block lg:hidden"
          >
            <AnimatePresence initial={false}>
              {column.map(([groupName, groupParks]) => (
                <ParkCategoryCard
                  key={groupName}
                  groupName={groupName}
                  parks={groupParks}
                />
              ))}
            </AnimatePresence>
          </motion.div>
        ))}

        {/* Mobile: single column */}
        <motion.div layout className="space-y-8 block md:hidden">
          <AnimatePresence initial={false}>
            {getMobileParks().map(([groupName, groupParks]) => (
              <ParkCategoryCard
                key={groupName}
                groupName={groupName}
                parks={groupParks}
              />
            ))}
          </AnimatePresence>
        </motion.div>
      </motion.div>
    </div>
  );
}
