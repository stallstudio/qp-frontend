import type { UserPreferences } from "@/lib/user-preferences";

// Types du domaine utilisateur exposés par les routes /api/user/* et consommés
// par le UserProvider et la page Profil.

export interface AlertDTO {
  id: string;
  rideId: number;
  parkIdentifier: string;
  rideName: string;
  parkName: string;
  threshold: number;
  active: boolean;
  createdAt: string;
}

export interface AlertHistoryDTO {
  id: string;
  rideId: number;
  parkIdentifier: string;
  rideName: string;
  // Nom lisible du parc, résolu depuis la base principale au moment de la lecture
  // (l'historique ne stocke que l'identifiant). Repli sur l'identifiant si absent.
  parkName: string;
  threshold: number;
  actualWaitTime: number;
  sentAt: string;
}

export interface FavoritesPayload {
  parks: string[];
  rides: string[];
}

// Profil complet renvoyé par GET /api/user/me.
export interface UserProfile {
  id: string;
  email: string | null;
  name: string | null;
  image: string | null;
  preferences: UserPreferences;
  // false tant que l'utilisateur n'a jamais enregistré de préférence : déclenche
  // la fusion des réglages locaux au premier login (voir UserProvider).
  preferencesInitialized: boolean;
  favorites: FavoritesPayload;
  counts: {
    favorites: number;
    activeAlerts: number;
  };
}
