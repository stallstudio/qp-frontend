"use client";

import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import {
  getExistingSubscription,
  isPushSupported,
  notificationPermission,
  subscribeToPush,
  unsubscribeFromPush,
} from "@/lib/push-client";

// Gère l'abonnement Web Push de l'APPAREIL courant : état (supporté / permission /
// abonné) + actions (subscribe / unsubscribe), en synchronisant avec le serveur
// (/api/user/push). Pensé pour le formulaire de notification : activer une notif
// doit garantir que l'appareil est bien abonné pour recevoir le push.

type State = {
  supported: boolean;
  // Permission du navigateur : "default" | "granted" | "denied" | null (indispo).
  permission: NotificationPermission | null;
  subscribed: boolean;
  ready: boolean;
};

export function usePushNotifications() {
  const [state, setState] = useState<State>({
    supported: false,
    permission: null,
    subscribed: false,
    ready: false,
  });

  // Détection initiale (client) : support + permission + abonnement déjà présent.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supported = isPushSupported();
      const permission = notificationPermission();
      const existing = supported ? await getExistingSubscription() : null;
      if (cancelled) return;
      setState({
        supported,
        permission,
        subscribed: Boolean(existing),
        ready: true,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Demande la permission, s'abonne et persiste l'abonnement côté compte. Renvoie
  // true si l'appareil est bien abonné à l'issue.
  const subscribe = useCallback(async (): Promise<boolean> => {
    const payload = await subscribeToPush();
    if (!payload) {
      setState((s) => ({ ...s, permission: notificationPermission() }));
      return false;
    }
    try {
      await axios.post("/api/user/push", payload);
    } catch {
      return false;
    }
    setState((s) => ({
      ...s,
      subscribed: true,
      permission: notificationPermission(),
    }));
    return true;
  }, []);

  // Désabonne l'appareil (navigateur + serveur).
  const unsubscribe = useCallback(async (): Promise<void> => {
    const endpoint = await unsubscribeFromPush();
    if (endpoint) {
      try {
        await axios.delete("/api/user/push", { data: { endpoint } });
      } catch {
        // ignoré : l'endpoint mort sera de toute façon purgé au prochain envoi.
      }
    }
    setState((s) => ({ ...s, subscribed: false }));
  }, []);

  return { ...state, subscribe, unsubscribe };
}
