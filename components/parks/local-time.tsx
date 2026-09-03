"use client";

import { useEffect, useState } from "react";
import { getLocalTime } from "@/lib/utils";
import { Clock } from "lucide-react";
import { useTimeFormat } from "@/hooks/useTimeFormat";

type ParkLocalTimeProps = {
  timezone: string;
};

/** Une minute : le pas d'affichage, donc le pas de rafraîchissement. */
const TICK_MS = 60_000;

// Heure sur place, dans le fuseau du parc. Plus de libellé : l'icône d'horloge
// désigne l'heure, et la météo qui suit sur la même ligne dit assez qu'on parle
// de l'instant présent (la clé i18n `parkPage.localTime` a été supprimée).
export default function ParkLocalTime({ timezone }: ParkLocalTimeProps) {
  const { is12Hour } = useTimeFormat();

  /**
   * ⚠️ **`suppressHydrationWarning`, et il n'est pas décoratif.**
   *
   * `getLocalTime` appelle `DateTime.now()` PENDANT le rendu. Le serveur peint
   * donc « 09:09 » et le navigateur recalcule à l'hydratation — même valeur la
   * plupart du temps, mais **pas quand la minute change entre les deux**. D'où
   * une erreur d'hydratation intermittente, exactement le cas que le message de
   * React nomme (« Variable input such as `Date.now()` »), et qu'on cherche
   * longtemps parce qu'elle ne se reproduit qu'une fois sur soixante.
   *
   * Et comme React abandonne alors l'hydratation du sous-arbre pour le re-rendre,
   * le symptôme visible pouvait tomber bien plus loin — sur l'`aria-controls`
   * des onglets, dont Radix dérive l'identifiant de la position dans l'arbre.
   *
   * ⚠️ **`mounted` aurait été le mauvais outil ici**, contrairement au reste de
   * la page (`main-card`). Il aurait laissé un trou à la place de l'heure sur la
   * première image — dans le bandeau du parc, la zone la plus regardée. Ici le
   * HTML servi est JUSTE : il n'est qu'un peu vieux, et une seconde suffit à le
   * corriger. C'est précisément ce pour quoi `suppressHydrationWarning` existe.
   */
  const [now, setNow] = useState(() => getLocalTime(timezone, is12Hour));

  useEffect(() => {
    // Recalculé immédiatement : c'est CE rendu-ci qui rattrape l'écart éventuel
    // avec l'heure du serveur, sans attendre la fin du premier intervalle.
    setNow(getLocalTime(timezone, is12Hour));
    const timer = setInterval(
      () => setNow(getLocalTime(timezone, is12Hour)),
      TICK_MS,
    );
    return () => clearInterval(timer);
  }, [timezone, is12Hour]);

  return (
    <div className="flex items-center gap-2 text-white">
      <Clock className="w-4 h-4" />
      <p suppressHydrationWarning>{now}</p>
    </div>
  );
}
