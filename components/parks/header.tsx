"use client";

import ParkCoverImage from "./cover-image";
import ParkOpeningHours from "./opening-hours";
import ParkLocalTime from "./local-time";
import Link from "next/link";
import { Undo2 } from "lucide-react";
import { ParkStatusBadge } from "./name-status";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getParkStatus } from "@/lib/utils";
import { useTranslations } from "next-intl";
import { ParkLiveData } from "@/types/api";
import { useFavorites } from "@/hooks/useFavorites";
import FavoriteStar from "@/components/ui/favorite-star";

const EXPANDED_HEIGHT = 288;
const COLLAPSED_HEIGHT = 96;
const SHRINK_DISTANCE = 220;
const FIXED_TOP = 16;

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

type ParkHeaderProps = {
  park: ParkLiveData;
};

export default function ParkHeader({ park }: ParkHeaderProps) {
  const t = useTranslations("parkPage");
  const tFav = useTranslations("favorites");
  const [scrollY, setScrollY] = useState(0);
  const searchParams = useSearchParams();
  const backParam = searchParams.get("back");
  const homeHref = backParam ? `/?${decodeURIComponent(backParam)}` : "/";
  const { isFavorite, toggle } = useFavorites("parks");
  const isFav = isFavorite(park.identifier);

  // Distance (px) entre le centre du nom et le bas de la carte, en flux normal
  // (donc indépendante de la hauteur de la carte et du transform appliqué).
  // Mesurée via offsetTop/offsetHeight qui ignorent les transforms.
  const nameRef = useRef<HTMLHeadingElement>(null);
  const detailsBlockRef = useRef<HTMLDivElement>(null);
  const [nameOffsetFromBottom, setNameOffsetFromBottom] = useState(82);

  useEffect(() => {
    const measure = () => {
      const nameEl = nameRef.current;
      const blockEl = detailsBlockRef.current;
      if (!nameEl || !blockEl) return;
      const naturalCenter = nameEl.offsetTop + nameEl.offsetHeight / 2;
      setNameOffsetFromBottom(blockEl.offsetHeight - naturalCenter);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [park.name, park.openingHours]);

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

  const detailsOpacity = clamp01(1 - shrinkProgress * 1.6);
  const backOpacity = clamp01(1 - shrinkProgress * 2);

  // Le nom est un élément UNIQUE (pas de crossfade -> pas de doublon). Il part
  // de sa position naturelle dans le bloc détaillé (ancré en bas) et glisse
  // jusqu'au centre de la carte en état compact. Le translate cible : centre de
  // carte (cardHeight/2 depuis le bas) - position naturelle du nom (offset).
  const nameTranslateY =
    shrinkProgress * (nameOffsetFromBottom - cardHeight / 2);
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
        <div className="max-w-4xl lg:max-w-6xl mx-auto px-3 sm:px-4">
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

            {/* Bloc détaillé ancré en bas (mise en page d'origine : pleine
                largeur naturelle -> pas de coupe ni de retour à la ligne
                parasite). Le badge et les horaires / heure locale se fondent en
                scrollant ; le NOM, lui, reste opaque et glisse jusqu'au centre.
                Un seul nom rendu -> pas de dédoublement. */}
            <div ref={detailsBlockRef} className="absolute left-0 bottom-0 p-4 z-10">
              <div
                className="w-fit mb-2"
                style={{
                  opacity: detailsOpacity,
                  pointerEvents: detailsOpacity > 0.05 ? "auto" : "none",
                }}
              >
                <ParkStatusBadge status={getParkStatus(park.openingHours)} />
              </div>

              <h2
                ref={nameRef}
                className="text-2xl [@media(min-width:380px)]:text-3xl font-bold text-white line-clamp-2 mb-2"
                style={{
                  transform: `translateY(${nameTranslateY}px)`,
                  willChange: "transform",
                }}
              >
                {park.name}
              </h2>

              <div
                style={{
                  opacity: detailsOpacity,
                  pointerEvents: detailsOpacity > 0.05 ? "auto" : "none",
                }}
              >
                <ParkOpeningHours
                  timezone={park.timezone}
                  openingHours={park.openingHours}
                />
                <ParkLocalTime timezone={park.timezone} />
              </div>
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
                href={homeHref}
                className="flex items-center gap-2 text-white text-sm"
              >
                <Undo2 className="size-4" />
                {t("backHome")}
              </Link>
            </div>

            <div
              className="absolute right-0 bottom-0 p-4 z-10"
              style={{
                opacity: detailsOpacity,
                pointerEvents: detailsOpacity > 0.05 ? "auto" : "none",
              }}
            >
              <FavoriteStar
                active={isFav}
                onToggle={() => toggle(park.identifier)}
                label={isFav ? tFav("removePark") : tFav("addPark")}
                size="md"
                className={`p-1.5 bg-black/25 backdrop-blur-sm hover:bg-black/35 ${
                  isFav ? "text-amber-400" : "text-white/90 hover:text-white"
                }`}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
