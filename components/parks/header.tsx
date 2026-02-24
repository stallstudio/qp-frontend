"use client";

import { ParkData } from "@/types/park";
import ParkCoverImage from "./cover-image";
import ParkOpeningHours from "./openingHours";
import ParkLocalTime from "./localTime";
import Link from "next/link";
import { Undo2 } from "lucide-react";
import ParkNameStatus from "./nameStatus";
import { useEffect, useState } from "react";
import { getParkStatus } from "@/lib/utils";
import { useTranslations } from "next-intl";

const EXPANDED_HEIGHT = 288;
const COLLAPSED_HEIGHT = 96;
const SHRINK_DISTANCE = 220;
const FIXED_TOP = 16;

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

type ParkHeaderProps = {
  park: ParkData;
};

export default function ParkHeader({ park }: ParkHeaderProps) {
  const t = useTranslations("parkPage");
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    let rafId = 0;

    const updateScrollY = () => {
      rafId = 0;
      setScrollY(Math.max(0, window.scrollY));
    };

    const handleScroll = () => {
      if (rafId) return;
      rafId = window.requestAnimationFrame(updateScrollY);
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (rafId) {
        window.cancelAnimationFrame(rafId);
      }
    };
  }, []);

  const shrinkProgress = clamp01(scrollY / SHRINK_DISTANCE);
  const cardHeight =
    EXPANDED_HEIGHT - (EXPANDED_HEIGHT - COLLAPSED_HEIGHT) * shrinkProgress;
  const spacerHeight =
    FIXED_TOP + cardHeight + Math.min(scrollY, SHRINK_DISTANCE);

  const detailsOpacity = clamp01(1 - shrinkProgress * 1.45);
  const compactOpacity = clamp01((shrinkProgress - 0.34) / 0.46);
  const backOpacity = clamp01(1 - shrinkProgress * 2);

  const detailsTranslateY = shrinkProgress * 16;
  const compactTranslateY = (1 - compactOpacity) * 14;
  const backTranslateY = shrinkProgress * -8;
  const imageScale = 1 + (1 - shrinkProgress) * 0.08;

  return (
    <>
      <div className="w-full" style={{ height: `${spacerHeight}px` }} />

      <div className="fixed inset-x-0 top-0 z-40 h-20 bg-linear-to-b from-background via-background/95 to-transparent pointer-events-none" />

      <div
        className="fixed left-0 right-0 z-50"
        style={{ top: `${FIXED_TOP}px` }}
      >
        <div className="max-w-4xl mx-auto px-4">
          <div
            className="relative w-full overflow-hidden rounded-4xl border border-white/10 shadow-sm"
            style={{ height: `${cardHeight}px` }}
          >
            <ParkCoverImage
              parkIdentifier={park.identifier}
              parkName={park.name}
              coverUrls={park.cover}
              imageScale={imageScale}
            />
            <div className="absolute inset-0 z-0 bg-linear-to-r from-black/80 via-black/45 to-black/20" />
            <div className="absolute inset-0 z-0 bg-linear-to-t from-black/40 via-transparent to-black/20" />

            <div
              className="absolute left-0 bottom-0 p-4 z-10"
              style={{
                opacity: detailsOpacity,
                transform: `translateY(${detailsTranslateY}px)`,
                pointerEvents: detailsOpacity > 0.05 ? "auto" : "none",
              }}
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
              className="absolute inset-y-0 left-0 z-10 flex items-center px-4"
              style={{
                opacity: compactOpacity,
                transform: `translateY(${compactTranslateY}px)`,
                pointerEvents: compactOpacity > 0.1 ? "auto" : "none",
              }}
            >
              <ParkNameStatus
                name={park.name}
                status={getParkStatus(park.openingHours)}
                displayStatus={false}
              />
            </div>

            <div
              className="absolute left-0 top-0 p-4 z-10"
              style={{
                opacity: backOpacity,
                transform: `translateY(${backTranslateY}px)`,
                pointerEvents: backOpacity > 0.05 ? "auto" : "none",
              }}
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
