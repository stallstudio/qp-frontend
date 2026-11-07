// Coquille commune des popups « détail » (attraction, POI, spectacle) :
// en-tête épinglée + corps défilant, voir `AttractionDetailDialog`.
//
// ⚠️ **Ancrée par le HAUT, pas centrée** (2026-11-07). Le `DialogContent` de
// shadcn se centre par `top: 50%` + `translate: -50%` : sa position dépend de sa
// hauteur, et toute section qui grandit après l'ouverture (graphique chargé,
// alerte retrouvée) faisait remonter le haut du popup de la moitié de cette
// croissance. Sur iPhone c'était pire : Safari fige la position pendant le zoom
// d'ouverture (200 ms), puis recentre d'un coup à la fin — un saut de ~25 px
// vers le haut à chaque ouverture. Ancré en haut, un popup qui grandit
// s'allonge vers le bas et son haut ne bouge plus jamais.
//
// Le haut : 6 % de l'écran (88dvh de hauteur max laissent 6 % en bas), mais
// jamais sous l'encoche ni la barre d'état d'une PWA en plein écran.
export const DETAIL_DIALOG_CLASS =
  "flex max-h-[88dvh] flex-col gap-0 overflow-hidden rounded-4xl border-0 p-0 sm:max-w-md top-[max(6dvh,calc(env(safe-area-inset-top)+0.75rem))] translate-y-0";
