"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Star, Bell, SlidersHorizontal } from "lucide-react";
import { useRouter } from "@/i18n/routing";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Footer from "@/components/ui/footer";
import ScrollShrinkHeader from "@/components/ui/scroll-shrink-header";
import { useUser } from "@/components/providers/user-provider";
import PreferencesCard from "./preferences-card";
import AlertsSection from "./alerts-section";
import AlertHistorySection from "./alert-history-section";

// Une statistique compacte (favoris / notifications actives), en tuile bordée
// (dans la carte à onglets, pas de carte imbriquée).
function Stat({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border px-4 py-3">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
        {icon}
      </div>
      <div>
        <p className="text-2xl font-bold leading-none">{value}</p>
        <p className="mt-1 text-sm text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

// Page profil, calquée sur la page « À propos » : header scroll-shrink partagé +
// carte à onglets (rounded-4xl, pastille coulissante). Deux onglets : Préférences
// et Notifications.
export default function ProfilePageClient() {
  const t = useTranslations("profile");
  const { status, profile } = useUser();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("alerts");

  // Garde côté client : si l'utilisateur se déconnecte depuis cette page, retour
  // à l'accueil (la garde serveur couvre l'accès direct sans session).
  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/");
    }
  }, [status, router]);

  if (status !== "authenticated") {
    return null;
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-8 px-3 sm:px-4 lg:max-w-6xl">
      {/* Mêmes marges que la page À propos : `mt-4` + `gap-1` pour que la carte à
          onglets colle au header. */}
      <main className="mt-4 flex flex-1 flex-col gap-1">
        <ScrollShrinkHeader
          title={t("heroTitle")}
          subtitle={t("heroSubtitle")}
          backLabel={t("backHome")}
        />

        <Card className="w-full gap-0 rounded-4xl p-2.5 sm:p-4">
          {/* Statistiques en tête de carte. */}
          <div className="grid grid-cols-2 gap-3 p-1 pb-3 sm:gap-4">
            <Stat
              icon={<Star className="size-5" />}
              value={profile?.counts.favorites ?? 0}
              label={t("favoritesCount")}
            />
            <Stat
              icon={<Bell className="size-5" />}
              value={profile?.counts.activeAlerts ?? 0}
              label={t("activeAlertsCount")}
            />
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="relative w-full overflow-hidden rounded-3xl">
              {/* Pastille coulissante (reprend le comportement des pages parc). */}
              <span
                aria-hidden
                className="pointer-events-none absolute bottom-[3px] left-[3px] top-[3px] w-[calc(50%-3px)] rounded-3xl bg-background shadow-sm dark:border dark:border-input dark:bg-input/30"
                style={{
                  transform:
                    activeTab === "preferences"
                      ? "translateX(100%)"
                      : "translateX(0%)",
                  transitionProperty: "transform",
                  transitionDuration: "1000ms",
                  transitionTimingFunction: "cubic-bezier(0.32, 0.72, 0, 1)",
                }}
              />
              <TabsTrigger
                value="alerts"
                className="relative z-10 rounded-3xl data-[state=active]:bg-transparent data-[state=active]:shadow-none dark:data-[state=active]:border-transparent dark:data-[state=active]:bg-transparent"
              >
                <Bell />
                {t("tabs.alerts")}
              </TabsTrigger>
              <TabsTrigger
                value="preferences"
                className="relative z-10 rounded-3xl data-[state=active]:bg-transparent data-[state=active]:shadow-none dark:data-[state=active]:border-transparent dark:data-[state=active]:bg-transparent"
              >
                <SlidersHorizontal />
                {t("tabs.preferences")}
              </TabsTrigger>
            </TabsList>

            {/* Onglet 1 : notifications (actives + historique). */}
            <TabsContent value="alerts" className="p-2 pt-5 sm:p-4">
              <h2 className="mb-1 text-2xl font-bold tracking-tight">
                {t("alertsTitle")}
              </h2>
              {/* Rappel : les alertes ne valent que pour la journée en cours. */}
              <p className="mb-4 text-sm text-muted-foreground">
                {t("alertsDailyNote")}
              </p>
              <AlertsSection />

              <h3 className="mt-8 mb-3 text-2xl font-bold tracking-tight">
                {t("historyTitle")}
              </h3>
              <AlertHistorySection />
            </TabsContent>

            {/* Onglet 2 : préférences. */}
            <TabsContent value="preferences" className="p-2 pt-5 sm:p-4">
              <h2 className="mb-4 text-2xl font-bold tracking-tight">
                {t("preferencesTitle")}
              </h2>
              <PreferencesCard />
            </TabsContent>
          </Tabs>
        </Card>
      </main>

      <Footer />
    </div>
  );
}
