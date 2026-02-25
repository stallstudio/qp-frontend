import { getLocalTime } from "@/lib/utils";
import { Clock } from "lucide-react";
import { useTranslations } from "next-intl";

type ParkLocalTimeProps = {
  timezone: string;
};

export default function ParkLocalTime({ timezone }: ParkLocalTimeProps) {
  const t = useTranslations("parkPage");
  return (
    <div className="flex items-center gap-2 text-white">
      <Clock className="w-4 h-4" />
      <p>
        <span className="font-medium">{t("localTime")}</span>:{" "}
        {getLocalTime(timezone)}
      </p>
    </div>
  );
}
