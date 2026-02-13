"use client";

import { ParkData } from "@/types/park";
import Image from "next/image";
import ParkOpeningHours from "./openingHours";
import ParkLocalTime from "./localTime";
import Link from "next/link";
import { Undo2 } from "lucide-react";
import ParkNameStatus from "./nameStatus";
import { useEffect, useRef, useState } from "react";
import { getParkStatus } from "@/lib/utils";
import { useTranslations } from "next-intl";

type ParkHeaderProps = {
  park: ParkData;
};

export default function ParkHeader({ park }: ParkHeaderProps) {
  const t = useTranslations("parkPage");
  const [isShrunken, setIsShrunken] = useState(false);
  const [selectedCover, setSelectedCover] = useState(
    "https://cdn.queue-park.com/default_cover.webp",
  );
  const hasProcessedRef = useRef<string | null>(null);

  console.log(park);
  useEffect(() => {
    // Faire tourner les photos en utilisant localStorage pour suivre l'index
    // Ne s'exécute qu'une seule fois par parc
    if (hasProcessedRef.current === park.identifier) return;

    if (!park.cover || park.cover.length === 0) {
      setSelectedCover("https://cdn.queue-park.com/default_cover.webp");
    } else {
      // Récupérer tous les index depuis localStorage
      const allIndexes = JSON.parse(
        localStorage.getItem("park-cover-index") || "{}",
      );
      const currentIndex = allIndexes[park.identifier] || 0;
      const nextIndex = (currentIndex + 1) % park.cover.length;

      setSelectedCover(park.cover[nextIndex]);

      // Mettre à jour l'index pour ce parc
      allIndexes[park.identifier] = nextIndex;
      localStorage.setItem("park-cover-index", JSON.stringify(allIndexes));
    }

    hasProcessedRef.current = park.identifier;
  }, [park.cover, park.identifier]);

  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;

      // Hysteresis: different thresholds for shrinking and expanding
      // This prevents flickering when scroll position is near the threshold
      if (!isShrunken && scrollY > 50) {
        setIsShrunken(true);
      } else if (isShrunken && scrollY < 20) {
        setIsShrunken(false);
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [isShrunken]);

  return (
    <>
      {/* Placeholder to maintain document flow and prevent content jump */}
      <div
        className={`w-full transition-all duration-300 ${isShrunken ? "h-28" : "h-76"}`}
      />

      {/* Background cover to prevent content showing behind header */}
      <div className="fixed top-0 left-0 right-0 h-12 bg-background z-40" />

      <div className="fixed top-4 left-0 right-0 z-50">
        <div className="max-w-4xl mx-auto px-4">
          <div
            className={`relative w-full rounded-4xl shadow-sm border transition-all duration-300 ${
              isShrunken ? "h-24" : "h-72"
            }`}
          >
            <Image
              src={selectedCover}
              alt={park.name}
              width={1920}
              height={1080}
              className="object-cover w-full h-full rounded-3xl"
            />
            <div className="absolute left-0 bottom-0 w-full h-full z-0">
              <div className="bg-linear-to-r from-black/80 via-black/40 to-transparent w-full h-full rounded-3xl"></div>
            </div>
            <div
              className={`absolute left-0 bottom-0 p-4 z-10 transition-opacity duration-300 ${isShrunken ? "opacity-0 pointer-events-none" : "opacity-100"}`}
            >
              <ParkNameStatus
                name={park.name}
                status={getParkStatus(park.openingHours)}
                displayStatus
              />
              <ParkOpeningHours
                timezone={park.timezone}
                openingHours={park.openingHours}
              />
              <ParkLocalTime timezone={park.timezone} />
            </div>

            {/* Shrunk state - only show name */}
            <div
              className={`absolute left-0 top-1/2 -translate-y-1/2 px-4 z-10 transition-opacity duration-300 ${isShrunken ? "opacity-100" : "opacity-0 pointer-events-none"}`}
            >
              <ParkNameStatus
                name={park.name}
                status={getParkStatus(park.openingHours)}
                displayStatus={false}
              />
            </div>

            <div
              className={`absolute left-0 top-0 p-4 z-10 transition-opacity duration-300 ${isShrunken ? "opacity-0 pointer-events-none" : "opacity-100"}`}
            >
              <Link
                href={`/`}
                className="flex items-center gap-2 text-white text-sm"
              >
                <Undo2 className="size-4" />
                {t("backHome")}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
