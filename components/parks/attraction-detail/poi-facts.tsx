"use client";

import { Skull } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { priceForToday, type PoiPrice } from "@/lib/poi-facts";
import { useParkCloseMinutes } from "@/components/parks/poi-hours-context";
import { Stat, STAT_STRIP_MAX_CELLS } from "./live-stats";

/** « 6,50 € », « 8 € » : pas de décimales inutiles sur un prix rond. */
function formatPrice(amount: number, currency: string, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/** La peur et le prix du jour d'une maison hantée, déjà mis en mots. */
export type PoiFactValues = {
  fearLevel: number | null;
  price: {
    amount: string;
    // « Gratuit » : un mot, pas un nombre — il ne prend pas la même taille.
    free: boolean;
    note: string | null;
  } | null;
};

/**
 * Niveau de peur et prix d'accès d'une maison hantée, prêts à afficher —
 * partagés par les popups attraction, spectacle et POI : selon la source, une
 * maison est publiée en spectacle (parcs CDA) ou en attraction.
 *
 * ⚠️ **Le prix du jour est DÉDUIT de l'heure de fermeture du parc** (voir
 * `priceForToday`) : 6,50 € une journée qui ferme à 18:00, 7,50 € une qui ferme
 * à 22:00. Quand rien ne permet de trancher — hors page de parc, horaires
 * inconnus —, les deux prix s'affichent, ce qui n'est jamais faux.
 *
 * Chaque moitié n'existe que si la source la publie.
 */
export function usePoiFacts(
  fearLevel: number | null,
  price: PoiPrice | null,
): PoiFactValues {
  const t = useTranslations("poiFacts");
  const locale = useLocale();
  const closeMinutes = useParkCloseMinutes();
  if (!price) return { fearLevel, price: null };

  const priced = (amount: number, note: string | null = null) => ({
    amount:
      amount === 0 ? t("free") : formatPrice(amount, price.currency, locale),
    free: amount === 0,
    note,
  });

  const today = priceForToday(price, closeMinutes);
  if (today === "extended" && price.extended !== null) {
    return { fearLevel, price: priced(price.extended, t("extendedToday")) };
  }
  if (today === "standard" && price.standard !== null) {
    return { fearLevel, price: priced(price.standard) };
  }
  if (price.standard !== null) {
    // Pas de quoi trancher : la journée classique d'abord, la prolongée en
    // précision quand elle diffère.
    const note =
      price.extended !== null && price.extended !== price.standard
        ? t("extendedPrice", { price: priced(price.extended).amount })
        : null;
    return { fearLevel, price: priced(price.standard, note) };
  }
  if (price.extended !== null) {
    // Une maison qui n'existe qu'en journée prolongée.
    return { fearLevel, price: priced(price.extended, t("extendedOnly")) };
  }
  return { fearLevel, price: null };
}

function factCount(facts: PoiFactValues): number {
  return (facts.fearLevel !== null ? 1 : 0) + (facts.price ? 1 : 0);
}

/**
 * La peur et le prix montent-ils dans le bandeau de chiffres ? Oui s'ils y
 * tiennent TOUS LES DEUX à côté de ses `stripCells` cases ; sinon, ils restent
 * ensemble dans le corps (`PoiFacts`).
 *
 * ⚠️ **Arbitré le 2026-10-08** : la règle d'origine les gardait toujours dans
 * le corps, le bandeau étant plafonné à trois cases. Mais une maison hantée
 * connue par ses seuls horaires (les maisons d'IBILAW, à Walibi Belgium) n'y
 * a qu'une case, « Fermeture » : le popup empilait alors deux blocs d'une
 * valeur chacun. Quand une attraction suivie en direct remplit le bandeau
 * (attente, état, horaires), rien ne change.
 *
 * ⚠️ Jamais l'un en haut et l'autre en bas : la peur et le prix décrivent la
 * même chose, ils se lisent ensemble.
 */
export function factsFitInStrip(
  facts: PoiFactValues,
  stripCells: number,
): boolean {
  const count = factCount(facts);
  return count > 0 && stripCells + count <= STAT_STRIP_MAX_CELLS;
}

/**
 * Les cases du bandeau, en TABLEAU : `StatStrip` compte ses enfants directs, un
 * fragment n'y compterait que pour une.
 */
export function poiFactStats(facts: PoiFactValues): React.ReactNode[] {
  return [
    facts.fearLevel !== null && <FearStat key="fear" level={facts.fearLevel} />,
    facts.price && <PriceStat key="price" price={facts.price} />,
  ];
}

function FearStat({ level }: { level: number }) {
  const t = useTranslations("poiFacts");
  return (
    <Stat label={t("fearLevel")}>
      <Skulls level={level} compact />
    </Stat>
  );
}

function PriceStat({ price }: { price: NonNullable<PoiFactValues["price"]> }) {
  const t = useTranslations("poiFacts");
  return (
    <Stat label={t("price")}>
      {/* « Gratuit » à la taille d'un état (`StatusValue`), un montant à celle
          d'une heure (`StatTime`). */}
      <span
        className={cn(
          "truncate leading-7",
          price.free
            ? "text-base font-semibold"
            : "text-xl font-bold tabular-nums",
        )}
      >
        {price.amount}
      </span>
      {price.note && (
        <span className="text-[11px] leading-tight text-muted-foreground">
          {price.note}
        </span>
      )}
    </Stat>
  );
}

/**
 * Cinq crânes, autant de rouges que le niveau. `compact` dans une case du
 * bandeau : une sur trois ne laisse que ~75 px sur un iPhone, que cinq crânes
 * de 16 px dépassaient.
 */
function Skulls({ level, compact }: { level: number; compact?: boolean }) {
  const t = useTranslations("poiFacts");
  return (
    <span
      className={cn(
        "flex items-center overflow-hidden",
        compact ? "h-7 gap-px" : "h-6 gap-0.5",
      )}
      role="img"
      aria-label={t("fearLevelValue", { level })}
    >
      {[1, 2, 3, 4, 5].map((step) => (
        <Skull
          key={step}
          aria-hidden="true"
          className={cn(
            "shrink-0",
            compact ? "size-3.5" : "size-4",
            step <= level
              ? "text-red-600 dark:text-red-400"
              : "text-muted-foreground/30",
          )}
        />
      ))}
    </span>
  );
}

/**
 * La peur et le prix sur une ligne, dans le CORPS du popup — quand ils ne
 * tiennent pas dans le bandeau (voir `factsFitInStrip`). Ce sont des
 * caractéristiques de la maison, pas l'état de l'instant : rien n'oblige à les
 * garder épinglées quand la place manque.
 *
 * Sans l'un ni l'autre, rien du tout.
 */
export default function PoiFacts({ facts }: { facts: PoiFactValues }) {
  const t = useTranslations("poiFacts");
  if (factCount(facts) === 0) return null;

  return (
    <div
      className={cn(
        "grid divide-x divide-border rounded-2xl border bg-muted/40",
        factCount(facts) === 2 ? "grid-cols-2" : "grid-cols-1",
      )}
    >
      {facts.fearLevel !== null && (
        <div className="flex min-w-0 flex-col gap-1 px-3.5 py-2.5">
          <span className="truncate text-[11px] font-medium text-muted-foreground">
            {t("fearLevel")}
          </span>
          <Skulls level={facts.fearLevel} />
        </div>
      )}
      {facts.price && (
        <div className="flex min-w-0 flex-col gap-1 px-3.5 py-2.5">
          <span className="truncate text-[11px] font-medium text-muted-foreground">
            {t("price")}
          </span>
          <span className="text-base leading-6 font-bold tabular-nums">
            {facts.price.amount}
          </span>
          {facts.price.note && (
            <span className="text-xs text-muted-foreground">
              {facts.price.note}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
