import { Park } from "@/types/park";
import { AnimatedShinyText } from "../ui/animated-shiny-text";
import { TrendingUp } from "lucide-react";
import ParkCard from "../parks/park-card";
import { Card, CardContent } from "../ui/card";
import { useTranslations } from "next-intl";

interface PopularParksProps {
  popularParks: Park[];
}

export default function PopularParks({ popularParks }: PopularParksProps) {
  const t = useTranslations("popularParks");
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-1">
        <h1 className="text-3xl font-bold">{t("title")}</h1>
        <div>
          <AnimatedShinyText className="flex items-center gap-2 text-sm">
            {t("trendingText")}
            <TrendingUp className="w-4 h-4" />
          </AnimatedShinyText>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {popularParks.map((park, index) => (
          <Card className="p-0" key={index}>
            <CardContent className="p-0">
              <ParkCard
                key={park.id}
                park={park}
                showBadge={false}
                note={`${Math.floor(Math.random() * (2000 - 1000 + 1)) + 1000} ${t("visitsNote")}`}
              />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
