"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

const EXPANDED_HEIGHT = 288;
const COLLAPSED_HEIGHT = 96;
const SHRINK_DISTANCE = 220;
const FIXED_TOP = 16;

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

export default function HomeHeader() {
  const t = useTranslations("home");
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

  const subtitleOpacity = clamp01(1 - shrinkProgress * 1.9);

  // Titre unique : descend (état détaillé) puis se recentre (état compact),
  // sans crossfade entre deux copies -> plus de dédoublement.
  const titleTranslateY = (1 - shrinkProgress) * 58;
  const titleScale = 1 + (1 - shrinkProgress) * 0.14;
  const imageScale = 1 + (1 - shrinkProgress) * 0.06;

  return (
    <>
      <div className="w-full" style={{ height: `${spacerHeight}px` }} />

      <div className="fixed inset-x-0 top-0 z-40 h-20 bg-linear-to-b from-background via-background/95 to-transparent pointer-events-none" />

      <div
        className="fixed left-0 right-0 z-50"
        style={{ top: `${FIXED_TOP}px` }}
      >
        <div className="max-w-4xl lg:max-w-6xl mx-auto px-3 sm:px-4">
          <div
            className="relative w-full overflow-hidden rounded-4xl border border-white/10 shadow-sm"
            style={{ height: `${cardHeight}px` }}
          >
            <Image
              src="/default_cover.webp"
              alt="Queue Park"
              width={1920}
              height={1080}
              className="absolute inset-0 h-full w-full object-cover"
              style={{ transform: `scale(${imageScale})` }}
            />

            <div className="absolute inset-0 z-0 bg-linear-to-t from-black/80 via-black/35 to-black/15" />
            <div className="absolute inset-0 z-0 bg-linear-to-r from-black/30 via-transparent to-black/10" />

            <div
              className="absolute inset-0 z-10 flex items-center justify-center px-6"
              style={{ transform: `translateY(${titleTranslateY}px)` }}
            >
              <div className="relative flex flex-col items-center">
                <h2
                  className="line-clamp-2 text-center text-3xl font-bold text-white"
                  style={{ transform: `scale(${titleScale})` }}
                >
                  {t("title")}
                </h2>
                <p
                  className="absolute top-full left-1/2 mt-2 w-max max-w-[80vw] -translate-x-1/2 text-center text-white/90"
                  style={{
                    opacity: subtitleOpacity,
                    pointerEvents: subtitleOpacity > 0.05 ? "auto" : "none",
                  }}
                >
                  {t("subtitle")}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
