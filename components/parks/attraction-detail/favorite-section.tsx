"use client";

import { Star } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { useFavorites } from "@/hooks/useFavorites";
import { cn } from "@/lib/utils";

// Ajout / retrait des favoris depuis le popup. Même mécanique que partout
// ailleurs (localStorage via useFavorites, miroité au compte par le UserProvider).
export default function FavoriteSection({ favKey }: { favKey: string }) {
  const tFav = useTranslations("favorites");
  const { isFavorite, toggle } = useFavorites("rides");
  const fav = isFavorite(favKey);

  return (
    <Button
      variant={fav ? "outline" : "default"}
      className="w-full"
      onClick={() => toggle(favKey)}
    >
      <Star className={cn("size-4", fav && "fill-amber-400 text-amber-400")} />
      {fav ? tFav("remove") : tFav("add")}
    </Button>
  );
}
