import { ParkStatus } from "@/types/park";
import { getStatusBadge } from "@/lib/badge";
import { useTranslations } from "next-intl";

interface ParkNameStatusProps {
  name: string;
  status: ParkStatus;
  displayStatus: boolean;
}

/**
 * Pastille d'état du parc (ouvert / fermé), extraite pour pouvoir l'afficher
 * indépendamment du nom dans le header (le nom y est un élément unique qui
 * glisse, les détails se fondent autour).
 */
export function ParkStatusBadge({ status }: { status: ParkStatus }) {
  const t = useTranslations("parkStatus");
  if (status === "unknown") return null;
  if (status === "open") {
    return (
      <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
        <div className="relative h-2 w-2">
          <div className="absolute top-0 left-0 w-2 h-2 bg-green-400 rounded-full" />
          <div className="absolute top-0 left-0 w-2 h-2 bg-green-400 rounded-full animate-ping" />
        </div>
        {t("open")}
      </div>
    );
  }
  return getStatusBadge("closed");
}

export default function ParkNameStatus({
  name,
  status,
  displayStatus = true,
}: ParkNameStatusProps) {
  return (
    <div className={`flex flex-col ${displayStatus ? "mb-2" : ""}`}>
      {displayStatus && (
        <div className="w-fit mb-2">
          <ParkStatusBadge status={status} />
        </div>
      )}
      <h2 className="text-2xl [@media(min-width:380px)]:text-3xl font-bold text-white line-clamp-2">
        {name}
      </h2>
    </div>
  );
}
