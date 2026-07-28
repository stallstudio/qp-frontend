import { getLocalTime } from "@/lib/utils";
import { Clock } from "lucide-react";
import { useTimeFormat } from "@/hooks/useTimeFormat";

type ParkLocalTimeProps = {
  timezone: string;
};

// Heure sur place, dans le fuseau du parc. Plus de libellé : l'icône d'horloge
// désigne l'heure, et la météo qui suit sur la même ligne dit assez qu'on parle
// de l'instant présent (la clé i18n `parkPage.localTime` a été supprimée).
export default function ParkLocalTime({ timezone }: ParkLocalTimeProps) {
  const { is12Hour } = useTimeFormat();
  return (
    <div className="flex items-center gap-2 text-white">
      <Clock className="w-4 h-4" />
      <p>{getLocalTime(timezone, is12Hour)}</p>
    </div>
  );
}
