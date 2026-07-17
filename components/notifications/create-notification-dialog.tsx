"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { Bell, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useUser } from "@/components/providers/user-provider";

export interface NotificationTarget {
  rideId: number;
  rideName: string;
}

interface CreateNotificationDialogProps {
  target: NotificationTarget | null;
  parkIdentifier: string;
  parkName: string;
  onOpenChange: (open: boolean) => void;
}

const THRESHOLD_OPTIONS = [10, 15, 20, 30, 45, 60];
const DEFAULT_THRESHOLD = 20;

// Popup de CRÉATION d'une notification, déclenché depuis une attraction (seul
// endroit autorisé — jamais depuis le profil). Contrôlé par la table parente.
export default function CreateNotificationDialog({
  target,
  parkIdentifier,
  parkName,
  onOpenChange,
}: CreateNotificationDialogProps) {
  const t = useTranslations("notifications");
  const { refresh } = useUser();
  const [threshold, setThreshold] = useState(DEFAULT_THRESHOLD);
  const [submitting, setSubmitting] = useState(false);

  // Réinitialise le seuil à chaque nouvelle attraction ciblée.
  useEffect(() => {
    if (target) setThreshold(DEFAULT_THRESHOLD);
  }, [target]);

  const submit = async () => {
    if (!target) return;
    setSubmitting(true);
    try {
      await axios.post("/api/user/notifications", {
        rideId: target.rideId,
        rideName: target.rideName,
        parkIdentifier,
        parkName,
        threshold,
      });
      toast.success(t("created", { ride: target.rideName }));
      refresh();
      onOpenChange(false);
    } catch {
      toast.error(t("createError"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={target !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="size-4 text-primary" />
            {t("createTitle")}
          </DialogTitle>
          <DialogDescription>
            {t("createDescription", { ride: target?.rideName ?? "" })}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2 py-2">
          <label className="text-sm font-medium">{t("thresholdLabel")}</label>
          <Select
            value={String(threshold)}
            onValueChange={(value) => setThreshold(Number(value))}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {THRESHOLD_OPTIONS.map((value) => (
                <SelectItem key={value} value={String(value)}>
                  {t("thresholdOption", { minutes: value })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">{t("thresholdHint")}</p>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            {t("cancel")}
          </Button>
          <Button onClick={submit} disabled={submitting}>
            {submitting && <Loader2 className="animate-spin" />}
            {t("create")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
