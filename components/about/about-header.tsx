"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { Undo2 } from "lucide-react";

// Mêmes constantes que le header d'accueil / parc pour un comportement identique.
const EXPANDED_HEIGHT = 288;
const COLLAPSED_HEIGHT = 96;
const SHRINK_DISTANCE = 220;
const FIXED_TOP = 16;

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

/**
 * En-tête de la page « À propos ». Reprend la mécanique EXACTE du header d'une
 * page parc : carte fixée en haut qui rétrécit au scroll, contenu aligné en bas
 * à gauche, titre qui glisse vers le centre en état compact, et lien de retour
 * top-left (même emplacement / format) qui se fond en scrollant.
 */
export default function AboutHeader() {
  const t = useTranslations("about");
  const [scrollY, setScrollY] = useState(0);

  // Distance (px) entre le centre du titre et le bas de la carte, en flux normal
  // (mesurée via offsetTop/offsetHeight qui ignorent les transforms). Sert à
  // faire glisser le titre pile au centre en état compact — comme sur une page
  // parc.
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
  }, [t]);

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

  // Le titre part de sa position naturelle (bas-gauche) et glisse jusqu'au
  // centre de la carte en état compact.
  const titleTranslateY =
    shrinkProgress * (titleOffsetFromBottom - cardHeight / 2);
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

            {/* Bloc détaillé ancré en bas à gauche (comme une page parc). Le
                titre reste opaque et glisse ; le sous-titre se fond au scroll. */}
            <div
              ref={detailsBlockRef}
              className="absolute left-0 bottom-0 p-4 z-10"
            >
              <h1
                ref={titleRef}
                className="text-2xl [@media(min-width:380px)]:text-3xl font-bold text-white line-clamp-2 mb-2"
                style={{
                  transform: `translateY(${titleTranslateY}px)`,
                  willChange: "transform",
                }}
              >
                {t("heroTitle")}
              </h1>
              <p
                className="max-w-xl text-sm text-white/90"
                style={{
                  opacity: detailsOpacity,
                  pointerEvents: detailsOpacity > 0.05 ? "auto" : "none",
                }}
              >
                {t("heroSubtitle")}
              </p>
            </div>

            {/* Lien de retour : même emplacement / format que les pages parc
                (top-left, p-4), et se fond en scrollant. */}
            <div
              className="absolute left-0 top-0 p-4 z-10"
              style={{
                opacity: backOpacity,
                transform: `translateY(${backTranslateY}px)`,
                pointerEvents: backOpacity > 0.05 ? "auto" : "none",
              }}
            >
              <Link
                href="/"
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
