import { POI_KIND_ICONS, type PoiKind } from "@/lib/poi-kinds";

// La couleur de chaque famille, en classes ENTIÈRES : Tailwind lit les sources
// comme du texte, une classe fabriquée par concaténation n'existerait pas dans
// le CSS produit.
const KIND_STYLES: Record<PoiKind, { dot: string; tile: string }> = {
  ride: { dot: "bg-primary", tile: "bg-primary/10 text-primary" },
  show: { dot: "bg-show", tile: "bg-show/10 text-show" },
  restaurant: {
    dot: "bg-restaurant",
    tile: "bg-restaurant/10 text-restaurant",
  },
  shop: { dot: "bg-shop", tile: "bg-shop/10 text-shop" },
  hotel: { dot: "bg-hotel", tile: "bg-hotel/10 text-hotel" },
  service: { dot: "bg-service", tile: "bg-service/10 text-service" },
};

/**
 * Marqueur de famille d'une ligne des fils d'alertes du profil (actives et
 * historique) : pastille à pictogramme dès `sm`, simple point de couleur sur
 * mobile — la pastille de 36 px y mangeait une largeur qui manque au nom.
 */
export default function FeedAvatar({ kind }: { kind: PoiKind }) {
  const Icon = POI_KIND_ICONS[kind];
  const style = KIND_STYLES[kind];
  return (
    <>
      <span
        aria-hidden
        className={`size-2.5 shrink-0 rounded-full sm:hidden ${style.dot}`}
      />
      <div
        className={`hidden size-9 shrink-0 items-center justify-center rounded-xl sm:flex ${style.tile}`}
      >
        <Icon className="size-4" />
      </div>
    </>
  );
}
