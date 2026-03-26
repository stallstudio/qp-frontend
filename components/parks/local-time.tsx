import { getLocalTime } from "@/lib/utils";
import { Clock } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTimeFormat } from "@/hooks/useTimeFormat";

type ParkLocalTimeProps = {
  timezone: string;
};

export default function ParkLocalTime({ timezone }: ParkLocalTimeProps) {
  const t = useTranslations("parkPage");
  const { is12Hour } = useTimeFormat();
  return (
    <div className="flex items-center gap-2 text-white">
      <Clock className="w-4 h-4" />
      <p>
        <span className="font-medium">{t("localTime")}</span>:{" "}
        {getLocalTime(timezone, is12Hour)}
      </p>
    </div>
  );
}
