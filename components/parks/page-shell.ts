// Classes du conteneur de la page d'un parc, partagées par la page réelle et
// son squelette de chargement (sans quoi le contenu « saute » à l'apparition).
//
// `min-h-[123vh]` n'est pas décoratif : l'en-tête de parc est `fixed` et rétrécit
// sur les 220 premiers pixels de défilement (`SHRINK_DISTANCE` dans
// `components/parks/header.tsx`). Sans hauteur minimale supérieure à la fenêtre,
// un parc comptant peu d'attractions ne serait pas scrollable du tout et
// l'en-tête resterait bloqué en position développée. Les ~23 % de marge
// couvrent cette distance sur les écrans les plus hauts.
export const PARK_PAGE_SHELL =
  "flex min-h-[123vh] w-full mx-auto max-w-4xl lg:max-w-6xl flex-col px-3 sm:px-4 gap-8";
