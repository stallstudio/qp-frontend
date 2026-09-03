"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import axios from "axios";
import { useSession } from "next-auth/react";
import type { AlertDTO, ShowReminderDTO } from "@/types/user";

/**
 * Notifications ACTIVES de l'utilisateur, pour les afficher dans les listes :
 * une cloche marque les attractions sous alerte et les spectacles dont un
 * rappel est programmé.
 *
 * Pourquoi un provider plutôt qu'un fetch par ligne : la liste d'un parc compte
 * des dizaines d'attractions, et les deux tableaux (attractions + spectacles)
 * coexistent sur la même page. Une seule requête par type, partagée, suffit.
 *
 * Contrairement aux favoris, aucun cache local : une alerte ne vaut que pour la
 * journée en cours (le cron la désactive le lendemain), un cache périmé
 * afficherait donc des cloches fantômes.
 */

interface NotificationsContextValue {
  // Attractions (rideId) avec une alerte de temps d'attente active.
  alertRideIds: Set<number>;
  // Spectacles avec au moins un rappel à venir, clés `${parc}:${nomDuSpectacle}`.
  reminderShowKeys: Set<string>;
  // À appeler après création/suppression depuis un popup pour que la cloche de
  // la ligne suive immédiatement.
  refresh: () => Promise<void>;
}

const NotificationsContext = createContext<
  NotificationsContextValue | undefined
>(undefined);

export const showReminderKey = (parkIdentifier: string, showName: string) =>
  `${parkIdentifier}:${showName}`;

export function NotificationsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { status } = useSession();
  const [alertRideIds, setAlertRideIds] = useState<Set<number>>(
    () => new Set(),
  );
  const [reminderShowKeys, setReminderShowKeys] = useState<Set<string>>(
    () => new Set(),
  );

  const load = useCallback(async () => {
    const [alerts, reminders] = await Promise.all([
      axios
        .get<AlertDTO[]>("/api/user/alerts")
        .then((res) => res.data)
        .catch(() => null),
      axios
        .get<ShowReminderDTO[]>("/api/user/show-reminders")
        .then((res) => res.data)
        .catch(() => null),
    ]);

    // Échec réseau : on garde l'état courant plutôt que d'effacer les cloches.
    if (alerts) {
      setAlertRideIds(
        new Set(alerts.filter((a) => a.active).map((a) => a.rideId)),
      );
    }
    if (reminders) {
      // Un rappel dont la représentation est passée ne concerne plus personne :
      // il ne doit plus marquer le spectacle.
      const now = Date.now();
      setReminderShowKeys(
        new Set(
          reminders
            .filter((r) => new Date(r.startTime).getTime() > now)
            .map((r) => showReminderKey(r.parkIdentifier, r.showName)),
        ),
      );
    }
  }, []);

  useEffect(() => {
    if (status === "loading") return;

    if (status === "unauthenticated") {
      setAlertRideIds(new Set());
      setReminderShowKeys(new Set());
      return;
    }

    load();
  }, [status, load]);

  // Une alerte est SUPPRIMÉE par le moteur dès qu'elle a notifié : sans ça, la
  // cloche de la ligne resterait allumée jusqu'au rechargement de la page —
  // typiquement juste après avoir reçu la notification, au retour dans l'app.
  // On se resynchronise donc au retour d'onglet, sans interrogation périodique.
  useEffect(() => {
    if (status !== "authenticated") return;
    const onVisible = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [status, load]);

  const value = useMemo(
    () => ({ alertRideIds, reminderShowKeys, refresh: load }),
    [alertRideIds, reminderShowKeys, load],
  );

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationsContext);
  if (context === undefined) {
    throw new Error(
      "useNotifications must be used within a NotificationsProvider",
    );
  }
  return context;
}
