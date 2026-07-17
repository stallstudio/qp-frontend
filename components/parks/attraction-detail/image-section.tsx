"use client";

import { ArrowRight, CameraOff } from "lucide-react";
import { useTranslations } from "next-intl";

// Lien placeholder vers Thrills (pas de deep-link par attraction pour l'instant).
const THRILLS_URL = "https://thrills.world";

// Image de l'attraction (placeholder `CameraOff` pour l'instant) avec, en bas et
// par-dessus, le nom de l'attraction + un lien Thrills, lisibles grâce à un
// dégradé sombre du bas vers le haut.
export default function ImageSection({ rideName }: { rideName: string }) {
  const t = useTranslations("attractionDetail");

  return (
    <div className="relative aspect-video w-full overflow-hidden bg-muted">
      <div className="flex size-full items-center justify-center text-muted-foreground">
        <CameraOff className="size-8" />
      </div>

      {/* Dégradé pour la lisibilité du texte. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-linear-to-t from-black/80 via-black/40 to-transparent" />

      <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-1 px-4 pb-3 text-center">
        <p className="text-lg font-semibold text-white drop-shadow-sm">
          {rideName}
        </p>
        <a
          href={THRILLS_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs font-medium text-white/90 transition-colors hover:text-white"
        >
          {t("thrillsLink")}
          <ArrowRight className="size-3.5" />
        </a>
      </div>
    </div>
  );
}
