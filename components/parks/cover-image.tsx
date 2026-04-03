"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { CoverImage } from "@/types/api";

const DEFAULT_COVER = "/default_cover.webp";

type ParkCoverImageProps = {
  parkIdentifier: string;
  parkName: string;
  coverUrls: CoverImage[] | null;
  imageScale: number;
};

export default function ParkCoverImage({
  parkIdentifier,
  parkName,
  coverUrls,
  imageScale,
}: ParkCoverImageProps) {
  const [selectedCover, setSelectedCover] = useState<CoverImage>({
    url: DEFAULT_COVER,
    credit: null,
  });
  const [isImageLoaded, setIsImageLoaded] = useState(false);
  const [isRealImageReady, setIsRealImageReady] = useState(false);
  const hasProcessedRef = useRef<string | null>(null);

  useEffect(() => {
    if (hasProcessedRef.current === parkIdentifier) return;

    if (!coverUrls || coverUrls.length === 0) {
      setSelectedCover({ url: DEFAULT_COVER, credit: null });
      setIsImageLoaded(true);
    } else {
      let allIndexes: Record<string, number> = {};

      try {
        allIndexes = JSON.parse(
          localStorage.getItem("park-cover-index") || "{}",
        );
      } catch {
        allIndexes = {};
      }

      const currentIndex = allIndexes[parkIdentifier] ?? -1;
      const nextIndex = (currentIndex + 1) % coverUrls.length;

      setSelectedCover(coverUrls[nextIndex]);
      setIsImageLoaded(false);

      allIndexes[parkIdentifier] = nextIndex;
      localStorage.setItem("park-cover-index", JSON.stringify(allIndexes));
    }

    hasProcessedRef.current = parkIdentifier;
  }, [coverUrls, parkIdentifier]);

  useEffect(() => {
    if (selectedCover.url === DEFAULT_COVER) {
      setIsRealImageReady(true);
      return;
    }

    setIsRealImageReady(false);
    const img = document.createElement("img");
    img.src = selectedCover.url;
    img.onload = () => setIsRealImageReady(true);
    img.onerror = () => setIsRealImageReady(true);
  }, [selectedCover]);

  const showDefaultCover =
    !isImageLoaded || !isRealImageReady || selectedCover.url === DEFAULT_COVER;

  return (
    <>
      <Image
        src={selectedCover.url}
        alt={parkName}
        fill
        sizes="(max-width: 896px) 100vw, 896px"
        className="absolute inset-0 object-cover"
        style={{
          transform: `scale(${imageScale})`,
        }}
        fetchPriority="high"
        loading="eager"
        onLoad={() => setIsImageLoaded(true)}
        priority
      />

      <Image
        src={DEFAULT_COVER}
        alt={parkName}
        fill
        sizes="(max-width: 896px) 100vw, 896px"
        className="absolute inset-0 object-cover"
        style={{
          transform: `scale(${imageScale})`,
          opacity: showDefaultCover ? 1 : 0,
          transition: "opacity 500ms ease-in-out",
        }}
        fetchPriority="high"
        loading="eager"
        priority
      />

      {selectedCover.credit && (
        <div className="absolute top-3 right-4 z-50">
          <span className="text-[10px] text-white/60">
            © {selectedCover.credit}
          </span>
        </div>
      )}

      {coverUrls && coverUrls.length > 1 && (
        <>
          {coverUrls
            .filter((c) => c.url !== selectedCover.url)
            .slice(0, 2)
            .map((c, idx) => (
              <link key={idx} rel="prefetch" href={c.url} as="image" />
            ))}
        </>
      )}
    </>
  );
}
