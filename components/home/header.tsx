"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import UserBlock from "@/components/home/user-block";

// Mêmes constantes que les bannières de parc (components/parks/header.tsx) et
// que l'en-tête partagé (components/ui/scroll-shrink-header.tsx).
const EXPANDED_HEIGHT = 288;
const COLLAPSED_HEIGHT = 96;
const SHRINK_DISTANCE = 220;
const FIXED_TOP = 16;
// Retrait des éléments posés dans les coins de la bannière : p-4, comme le lien
// de retour et l'étoile favori des pages parc.
const EDGE_PADDING = 16;
// Hauteur de la pastille « compte » (h-8), pour la recentrer verticalement
// quand la bannière est repliée.
const PILL_HEIGHT = 32;

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

export default function HomeHeader() {
  const t = useTranslations("home");
  const title = t("title");
  const subtitle = t("subtitle");
  const [scrollY, setScrollY] = useState(0);

  // Distance (px) entre le centre du titre et le bas de la carte, en flux
  // normal : sert à le faire glisser pile au centre en état compact. Même
  // mesure que les bannières de parc (offsetTop/offsetHeight ignorent les
  // transforms).
  const titleRef = useRef<HTMLHeadingElement>(null);
  const detailsBlockRef = useRef<HTMLDivElement>(null);
  const [titleOffsetFromBottom, setTitleOffsetFromBottom] = useState(82);

  useEffect(() => {
    const measure = () => {
      const titleEl = titleRef.current;
      const blockEl = detailsBlockRef.current;
      if (!titleEl || !blockEl) return;
      const naturalCenter = titleEl.offsetTop + titleEl.offsetHeight / 2;
      setTitleOffsetFromBottom(blockEl.offsetHeight - naturalCenter);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [title, subtitle]);

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

  // Le titre part de sa position naturelle (bas gauche) et glisse jusqu'au
  // centre de la carte en état compact — il reste donc ferré à gauche.
  const titleTranslateY =
    shrinkProgress * (titleOffsetFromBottom - cardHeight / 2);
  const imageScale = 1 + (1 - shrinkProgress) * 0.08;

  // La pastille suit le même principe : posée à p-4 du coin, recentrée sur la
  // hauteur de la bannière repliée.
  const pillTranslateY =
    shrinkProgress * ((COLLAPSED_HEIGHT - PILL_HEIGHT) / 2 - EDGE_PADDING);

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
              priority
            />

            <div className="absolute inset-0 z-0 bg-linear-to-r from-black/80 via-black/45 to-black/20" />
            <div className="absolute inset-0 z-0 bg-linear-to-t from-black/40 via-transparent to-black/20" />

            {/* Bloc ancré en bas à gauche, comme les bannières de parc : le
                titre reste opaque et glisse au centre en état compact, le
                sous-titre se fond. */}
            <div
              ref={detailsBlockRef}
              className="absolute left-0 bottom-0 p-4 z-10"
            >
              <h2
                ref={titleRef}
                className="text-2xl [@media(min-width:380px)]:text-3xl font-bold text-white line-clamp-2 mb-2"
                style={{
                  transform: `translateY(${titleTranslateY}px)`,
                  willChange: "transform",
                }}
              >
                {title}
              </h2>
              <p
                className="max-w-xl text-sm text-white/90"
                style={{
                  opacity: detailsOpacity,
                  pointerEvents: detailsOpacity > 0.05 ? "auto" : "none",
                }}
              >
                {subtitle}
              </p>
            </div>

            {/* Compte : pastille discrète posée sur l'image, même retrait que
                les actions des pages parc (top-right, p-4). z-20 pour rester
                cliquable au-dessus du bloc titre. */}
            <div
              className="absolute right-0 top-0 p-4 z-20"
              style={{ transform: `translateY(${pillTranslateY}px)` }}
            >
              <UserBlock progress={shrinkProgress} />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
