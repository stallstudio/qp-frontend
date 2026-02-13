"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

export default function HomeHeader() {
  const t = useTranslations("home");
  const [isShrunken, setIsShrunken] = useState(false);

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
              src="https://queue-park.com/assets/images/couverture_estivale.jpg"
              alt="Queue Park"
              width={1920}
              height={1080}
              className="object-cover w-full h-full rounded-3xl"
            />
            <div className="absolute left-0 bottom-0 w-full h-full z-0">
              <div className="bg-linear-to-t from-black/80 via-black/40 to-transparent w-full h-full rounded-3xl"></div>
            </div>
            <div
              className={`absolute inset-0 flex items-center  flex-col ${isShrunken ? "p-2 justify-center" : "p-8 justify-end"}`}
            >
              <h2 className="text-3xl font-bold text-white line-clamp-2">
                {t("title")}
              </h2>
              <p
                className={`text-white transition-opacity duration-300 text-center ${isShrunken ? "opacity-0 h-0" : "opacity-100 h-auto"}`}
              >
                {t("subtitle")}
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
