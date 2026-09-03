"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
} from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { useUser } from "@/components/providers/user-provider";
import AuthDialog from "@/components/auth/auth-dialog";

interface AuthGateValue {
  // Renvoie true si l'utilisateur est connecté. Sinon : affiche une notification
  // informative + ouvre le modal de connexion, et renvoie false. À appeler dans un
  // gestionnaire d'événement avant toute action réservée aux comptes (favoris…).
  requireAuth: () => boolean;
}

const AuthGateContext = createContext<AuthGateValue | undefined>(undefined);

// Centralise le « garde d'authentification » : un seul AuthDialog partagé pour
// toute l'app, plus le toast informatif. Évite de dupliquer modal + message à
// chaque étoile favori. Monté sous UserProvider (a besoin de `isAuthenticated`).
export function AuthGateProvider({ children }: { children: React.ReactNode }) {
  const t = useTranslations("favorites");
  const { isAuthenticated } = useUser();
  const [authOpen, setAuthOpen] = useState(false);

  const requireAuth = useCallback(() => {
    if (isAuthenticated) return true;
    toast.info(t("needAccount"));
    setAuthOpen(true);
    return false;
  }, [isAuthenticated, t]);

  return (
    <AuthGateContext.Provider value={{ requireAuth }}>
      {children}
      <AuthDialog open={authOpen} onOpenChange={setAuthOpen} />
    </AuthGateContext.Provider>
  );
}

export function useAuthGate() {
  const context = useContext(AuthGateContext);
  if (context === undefined) {
    throw new Error("useAuthGate must be used within an AuthGateProvider");
  }
  return context;
}
