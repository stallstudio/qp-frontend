"use client";

import { Skull } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { priceForToday, type PoiPrice } from "@/lib/poi-facts";
import { useParkCloseMinutes } from "@/components/parks/poi-hours-context";

/** « 6,50 € », « 8 € » : pas de décimales inutiles sur un prix rond. */
function formatPrice(amount: number, currency: string, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Niveau de peur et prix d'accès d'une maison hantée, sur une ligne — partagés
 * par les popups attraction, spectacle et POI, comme `StatStrip` : selon la
 * source, une maison est publiée en spectacle (parcs CDA) ou en attraction.
 *
 * ⚠️ **Dans le corps, pas dans le bandeau de chiffres** : le bandeau est
 * plafonné à trois cases, et une maison hantée en remplit déjà deux (accès,
 * fermeture). Ce sont des caractéristiques de la maison, pas l'état de
 * l'instant : elles n'ont pas à rester épinglées.
 *
 * ⚠️ **Le prix du jour est DÉDUIT de l'heure de fermeture du parc** (voir
 * `priceForToday`) : 6,50 € une journée qui ferme à 18:00, 7,50 € une qui ferme
 * à 22:00. Quand rien ne permet de trancher — hors page de parc, horaires
 * inconnus —, les deux prix s'affichent, ce qui n'est jamais faux.
 *
 * Chaque moitié n'apparaît que si la source la publie ; sans l'une ni l'autre,
 * rien du tout.
 */
export default function PoiFacts({
  fearLevel,
  price,
}: {
  fearLevel: number | null;
  price: PoiPrice | null;
}) {
  const t = useTranslations("poiFacts");
  const locale = useLocale();
  const closeMinutes = useParkCloseMinutes();
  if (fearLevel === null && price === null) return null;

  const format = (amount: number) =>
    amount === 0 ? t("free") : formatPrice(amount, price!.currency, locale);

  let mainPrice: string | null = null;
  let note: string | null = null;
  if (price) {
    const today = priceForToday(price, closeMinutes);
    if (today === "extended" && price.extended !== null) {
      mainPrice = format(price.extended);
      note = t("extendedToday");
    } else if (today === "standard" && price.standard !== null) {
      mainPrice = format(price.standard);
    } else if (price.standard !== null) {
      // Pas de quoi trancher : la journée classique d'abord, la prolongée en
      // précision quand elle diffère.
      mainPrice = format(price.standard);
      if (price.extended !== null && price.extended !== price.standard) {
        note = t("extendedPrice", { price: format(price.extended) });
      }
    } else if (price.extended !== null) {
      // Une maison qui n'existe qu'en journée prolongée.
      mainPrice = format(price.extended);
      note = t("extendedOnly");
    }
  }

  return (
    <div
      className={cn(
        "grid divide-x divide-border rounded-2xl border bg-muted/40",
        fearLevel !== null && mainPrice !== null ? "grid-cols-2" : "grid-cols-1",
      )}
    >
      {fearLevel !== null && (
        <div className="flex min-w-0 flex-col gap-1 px-3.5 py-2.5">
          <span className="truncate text-[11px] font-medium text-muted-foreground">
            {t("fearLevel")}
          </span>
          <span
            className="flex h-6 items-center gap-0.5"
            role="img"
            aria-label={t("fearLevelValue", { level: fearLevel })}
          >
            {[1, 2, 3, 4, 5].map((step) => (
              <Skull
                key={step}
                aria-hidden="true"
                className={cn(
                  "size-4",
                  step <= fearLevel
                    ? "text-red-600 dark:text-red-400"
                    : "text-muted-foreground/30",
                )}
              />
            ))}
          </span>
        </div>
      )}
      {mainPrice !== null && (
        <div className="flex min-w-0 flex-col gap-1 px-3.5 py-2.5">
          <span className="truncate text-[11px] font-medium text-muted-foreground">
            {t("price")}
          </span>
          <span className="text-base leading-6 font-bold tabular-nums">{mainPrice}</span>
          {note && <span className="text-xs text-muted-foreground">{note}</span>}
        </div>
      )}
    </div>
  );
}
