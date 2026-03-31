"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "../ui/badge";
import {
  Sparkles,
  ImageIcon,
  Calendar,
  RefreshCw,
  UserCheck,
  Activity,
  MapPin,
  Zap,
  PlusCircle,
  Timer,
  Languages,
  Moon,
  Users,
  LucideIcon,
  ArrowRight,
} from "lucide-react";
import LanguageSwitcher from "../ui/language-switcher";

const STORAGE_KEY = "welcome-v2-seen";

const featureKeys: { key: string; icon: LucideIcon; important: boolean }[] = [
  { key: "showsTimeline", icon: Calendar, important: true },
  { key: "newParks", icon: PlusCircle, important: false },
  { key: "darkMode", icon: Moon, important: false },
  { key: "brandNewUI", icon: Sparkles, important: true },
  { key: "fastlaneWaitTimes", icon: Timer, important: false },
  { key: "autoRefresh", icon: RefreshCw, important: true },
  { key: "rotatingParkCovers", icon: ImageIcon, important: false },
  { key: "parkStatusIndicator", icon: Activity, important: true },
  { key: "singleRiderWaitTimes", icon: UserCheck, important: false },
  { key: "multiLanguage", icon: Languages, important: true },
  { key: "improvedPerformance", icon: Zap, important: false },
  { key: "countryParkFiltering", icon: MapPin, important: false },
  { key: "groupParkFiltering", icon: Users, important: false },
];

export default function WelcomeV2() {
  const t = useTranslations("welcome");
  const [isOpen, setIsOpen] = useState(false);

  // Ne plus afficher après le 1er juin 2026
  const isExpired = new Date() >= new Date("2026-06-01");

  useEffect(() => {
    if (isExpired) return;
    const hasSeen = localStorage.getItem(STORAGE_KEY);
    if (!hasSeen) {
      setIsOpen(true);
    }
  }, [isExpired]);

  const handleClose = () => {
    localStorage.setItem(STORAGE_KEY, "true");
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent showCloseButton={false} className="sm:max-w-md p-0">
        <div className="rounded-t-sm bg-linear-to-br from-primary to-orange-300 w-full p-6 flex flex-col items-center">
          <h2 className="font-bold text-white">{t("welcomeTo")}</h2>
          <div className="flex items-center gap-3">
            <h1 className="text-4xl font-extrabold text-white">Queue Park</h1>
            <span className="bg-white text-primary px-4 -mb-0.5 rounded-full font-extrabold">
              v2
            </span>
          </div>
        </div>
        <div className="flex flex-col items-center text-center gap-4 p-6 pt-0 min-w-0">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">
              {t("title")}
            </DialogTitle>
            <DialogDescription>{t("description")}</DialogDescription>
          </DialogHeader>

          <div
            className="w-full max-w-full overflow-hidden"
            style={{
              maskImage:
                "linear-gradient(to right, transparent, black 10%, black 90%, transparent)",
            }}
          >
            <div
              className="flex gap-2 animate-marquee"
              style={{ width: "max-content" }}
            >
              {[...featureKeys, ...featureKeys].map((feature, index) => (
                <Badge
                  variant="outline"
                  key={`${feature.key}-${index}`}
                  className={`gap-1 shrink-0 ${feature.important ? "border-primary text-primary" : ""}`}
                >
                  <feature.icon className="size-3" />
                  {t(`features.${feature.key}`)}
                </Badge>
              ))}
            </div>
          </div>

          <div className="flex items-center w-full gap-2">
            <Button onClick={handleClose} className="flex-1">
              {t("button")}
              <ArrowRight />
            </Button>
            <LanguageSwitcher
              showText={false}
              onLanguageChange={() => setIsOpen(false)}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
