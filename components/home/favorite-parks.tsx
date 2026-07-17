"use client";

import { ParkList } from "@/types/api";
import { Star } from "lucide-react";
import ParkCard from "../parks/park-card";
import { Card, CardContent } from "../ui/card";
import { useTranslations } from "next-intl";
import { useFavorites } from "@/hooks/useFavorites";

interface FavoriteParksProps {
  parks: ParkList[];
}

export default function FavoriteParks({ parks }: FavoriteParksProps) {
  const t = useTranslations("favorites");
  const { favorites, isReady } = useFavorites("parks");

  // Avant hydratation on ne rend rien (favorites vide) : pas de flash de section.
  if (!isReady || favorites.size === 0) {
    return null;
  }

  const favoriteParks = parks.filter((park) => favorites.has(park.identifier));

  if (favoriteParks.length === 0) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <h1 className="text-3xl font-bold">{t("myFavorites")}</h1>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {favoriteParks.map((park) => (
          <Card className="p-0" key={park.identifier}>
            <CardContent className="p-0 h-full">
              <ParkCard park={park} showBadge={false} />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
