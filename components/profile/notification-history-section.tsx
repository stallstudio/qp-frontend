"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import { DateTime } from "luxon";
import { useLocale, useTranslations } from "next-intl";
import { History, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTimeFormat } from "@/hooks/useTimeFormat";
import type { NotificationHistoryDTO } from "@/types/user";

// Section « Historique des notifications » : lecture seule. Ce qui a été envoyé
// est conservé (attraction, seuil configuré, attente réelle, date/heure d'envoi).
export default function NotificationHistorySection() {
  const t = useTranslations("profile");
  const locale = useLocale();
  const { is12Hour } = useTimeFormat();
  const [history, setHistory] = useState<NotificationHistoryDTO[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios
      .get<NotificationHistoryDTO[]>("/api/user/notifications/history")
      .then((res) => setHistory(res.data))
      .catch(() => setHistory([]))
      .finally(() => setLoading(false));
  }, []);

  const formatDate = (iso: string) =>
    DateTime.fromISO(iso)
      .setLocale(locale)
      .toLocaleString({
        ...DateTime.DATETIME_MED,
        hourCycle: is12Hour ? "h12" : "h23",
      });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="size-4 text-muted-foreground" />
          {t("historyTitle")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-6 text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
          </div>
        ) : history.length === 0 ? (
          <p className="py-2 text-sm text-muted-foreground">
            {t("historyEmpty")}
          </p>
        ) : (
          <ul className="divide-y">
            {history.map((h) => (
              <li key={h.id} className="py-3 first:pt-0 last:pb-0">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="truncate font-medium">{h.rideName}</p>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatDate(h.sentAt)}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {t("historyLine", {
                    actual: h.actualWaitTime,
                    threshold: h.threshold,
                  })}
                </p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
