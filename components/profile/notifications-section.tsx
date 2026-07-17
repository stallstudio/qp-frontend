"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { Bell, Trash2, Loader2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useUser } from "@/components/providers/user-provider";
import type { NotificationDTO } from "@/types/user";

// Section « Notifications actives » du profil : consulter, (dé)activer, supprimer.
// La CRÉATION ne se fait jamais ici — uniquement depuis le popup d'une attraction.
export default function NotificationsSection() {
  const t = useTranslations("profile");
  const { refresh } = useUser();
  const [notifications, setNotifications] = useState<NotificationDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    axios
      .get<NotificationDTO[]>("/api/user/notifications")
      .then((res) => setNotifications(res.data))
      .catch(() => toast.error(t("loadError")))
      .finally(() => setLoading(false));
  }, [t]);

  const toggleActive = async (notification: NotificationDTO) => {
    const next = !notification.active;
    setBusyId(notification.id);
    // Optimiste.
    setNotifications((list) =>
      list.map((n) => (n.id === notification.id ? { ...n, active: next } : n)),
    );
    try {
      await axios.patch(`/api/user/notifications/${notification.id}`, {
        active: next,
      });
      refresh();
    } catch {
      toast.error(t("updateError"));
      setNotifications((list) =>
        list.map((n) =>
          n.id === notification.id ? { ...n, active: !next } : n,
        ),
      );
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (notification: NotificationDTO) => {
    setBusyId(notification.id);
    const previous = notifications;
    setNotifications((list) => list.filter((n) => n.id !== notification.id));
    try {
      await axios.delete(`/api/user/notifications/${notification.id}`);
      toast.success(t("deleted"));
      refresh();
    } catch {
      toast.error(t("deleteError"));
      setNotifications(previous);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="size-4 text-muted-foreground" />
          {t("notificationsTitle")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-6 text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
          </div>
        ) : notifications.length === 0 ? (
          <p className="py-2 text-sm text-muted-foreground">
            {t("notificationsEmpty")}
          </p>
        ) : (
          <ul className="divide-y">
            {notifications.map((n) => (
              <li
                key={n.id}
                className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{n.rideName}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    {n.parkName} · {t("threshold", { minutes: n.threshold })}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <Switch
                    checked={n.active}
                    disabled={busyId === n.id}
                    onCheckedChange={() => toggleActive(n)}
                    aria-label={n.active ? t("deactivate") : t("activate")}
                  />
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    disabled={busyId === n.id}
                    onClick={() => remove(n)}
                    aria-label={t("delete")}
                  >
                    <Trash2 className="size-4 text-muted-foreground" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
