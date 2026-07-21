"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { Check, Trash2, Loader2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import NumberStepper from "@/components/ui/number-stepper";
import { ALERT_THRESHOLDS } from "@/lib/alert-thresholds";
import { useUser } from "@/components/providers/user-provider";
import type { AlertDTO } from "@/types/user";

// Section « Alertes actives » du profil : consulter, MODIFIER le seuil,
// (dé)activer, supprimer. La CRÉATION ne se fait jamais ici — uniquement depuis
// le popup d'une attraction. Rendu SANS carte (surface = carte à onglets du profil).

export default function AlertsSection() {
  const t = useTranslations("profile");
  const tAlert = useTranslations("alerts");
  const { refresh } = useUser();
  const [alerts, setAlerts] = useState<AlertDTO[]>([]);
  // Seuils ENREGISTRÉS (référence pour détecter une modification non validée).
  // Le seuil affiché vit dans `alerts` (brouillon) ; il ne part en base que
  // lorsque l'utilisateur valide (bouton ✓), pas à chaque clic sur +/−.
  const [savedThresholds, setSavedThresholds] = useState<Record<string, number>>(
    {},
  );
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  // Id de l'alerte dont le seuil est en cours d'enregistrement (spinner du ✓).
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    axios
      .get<AlertDTO[]>("/api/user/alerts")
      .then((res) => {
        setAlerts(res.data);
        setSavedThresholds(
          Object.fromEntries(res.data.map((a) => [a.id, a.threshold])),
        );
      })
      .catch(() => toast.error(t("loadError")))
      .finally(() => setLoading(false));
  }, [t]);

  const toggleActive = async (alert: AlertDTO) => {
    const next = !alert.active;
    setBusyId(alert.id);
    // Optimiste.
    setAlerts((list) =>
      list.map((a) => (a.id === alert.id ? { ...a, active: next } : a)),
    );
    try {
      await axios.patch(`/api/user/alerts/${alert.id}`, { active: next });
      refresh();
    } catch {
      toast.error(t("updateError"));
      setAlerts((list) =>
        list.map((a) => (a.id === alert.id ? { ...a, active: !next } : a)),
      );
    } finally {
      setBusyId(null);
    }
  };

  // Ajuste le SEUIL AFFICHÉ (brouillon) sans rien enregistrer : c'est le ✓ qui
  // valide.
  const changeThreshold = (alert: AlertDTO, next: number) => {
    setAlerts((list) =>
      list.map((a) => (a.id === alert.id ? { ...a, threshold: next } : a)),
    );
  };

  // Valide le nouveau seuil (bouton ✓) : PATCH puis mise à jour de la référence.
  const saveThreshold = async (alert: AlertDTO) => {
    setSavingId(alert.id);
    try {
      await axios.patch(`/api/user/alerts/${alert.id}`, {
        threshold: alert.threshold,
      });
      setSavedThresholds((m) => ({ ...m, [alert.id]: alert.threshold }));
      toast.success(t("thresholdSaved"));
      refresh();
    } catch {
      toast.error(t("updateError"));
    } finally {
      setSavingId(null);
    }
  };

  const remove = async (alert: AlertDTO) => {
    setBusyId(alert.id);
    const previous = alerts;
    setAlerts((list) => list.filter((a) => a.id !== alert.id));
    try {
      await axios.delete(`/api/user/alerts/${alert.id}`);
      toast.success(t("deleted"));
      refresh();
    } catch {
      toast.error(t("deleteError"));
      setAlerts(previous);
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-6 text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
      </div>
    );
  }

  if (alerts.length === 0) {
    return (
      <p className="py-2 text-sm text-muted-foreground">{t("alertsEmpty")}</p>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {alerts.map((a) => {
        // Seuil modifié mais pas encore validé → on propose le bouton ✓.
        const dirty = a.threshold !== savedThresholds[a.id];
        const saving = savingId === a.id;
        return (
          <li
            key={a.id}
            className="flex flex-col gap-2 rounded-xl border px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{a.rideName}</p>
              <p className="truncate text-xs text-muted-foreground">
                {a.parkName}
              </p>
            </div>
            <div className="flex shrink-0 items-center justify-between gap-2 sm:justify-end">
              <div className="flex items-center gap-2">
                {/* Édition du seuil : le +/− ne fait que modifier le brouillon ;
                    le bouton ✓ (visible seulement si modifié) enregistre. */}
                <NumberStepper
                  value={a.threshold}
                  onChange={(v) => changeThreshold(a, v)}
                  values={ALERT_THRESHOLDS}
                  disabled={saving}
                  format={(v) => tAlert("thresholdOption", { minutes: v })}
                  aria-label={tAlert("thresholdLabel")}
                />
                {dirty && (
                  <Button
                    size="icon-sm"
                    onClick={() => saveThreshold(a)}
                    disabled={saving}
                    aria-label={t("validate")}
                  >
                    {saving ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Check className="size-4" />
                    )}
                  </Button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={a.active}
                  disabled={busyId === a.id}
                  onCheckedChange={() => toggleActive(a)}
                  aria-label={a.active ? t("deactivate") : t("activate")}
                />
                <Button
                  variant="ghost"
                  size="icon-sm"
                  disabled={busyId === a.id}
                  onClick={() => remove(a)}
                  aria-label={t("delete")}
                >
                  <Trash2 className="size-4 text-muted-foreground" />
                </Button>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
