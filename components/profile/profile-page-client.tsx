"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Star, Bell, SlidersHorizontal, FerrisWheel, History } from "lucide-react";
import { useRouter } from "@/i18n/routing";
import { useFavorites } from "@/hooks/useFavorites";
import { PARK_FAVORITES_LIMIT } from "@/lib/favorites-storage";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Footer from "@/components/ui/footer";
import ScrollShrinkHeader from "@/components/ui/scroll-shrink-header";
import { useUser } from "@/components/providers/user-provider";
import PreferencesCard from "./preferences-card";
import AlertsSection from "./alerts-section";
import AlertHistorySection from "./alert-history-section";
import FavoritesPopup from "./favorites-popup";
import ProfileSkeleton from "./profile-skeleton";

// Une statistique compacte (favoris / notifications actives), en tuile bordée
// (dans la carte à onglets, pas de carte imbriquée). Cliquable si `onClick` est
// fourni (rendu alors en bouton, avec état de survol/focus).
function Stat({
  icon,
  value,
  label,
  max,
  onClick,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
  // Affiche « value/max » (le plafond en petit) : rappelle jusqu'où va la limite.
  max?: number;
  onClick?: () => void;
}) {
  const inner = (
    <>
      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
        {icon}
      </div>
      <div className="min-w-0 text-center sm:text-left">
        <p className="text-xl font-bold leading-none sm:text-2xl">
          {value}
          {max != null && (
            <span className="text-sm font-medium text-muted-foreground">
              /{max}
            </span>
          )}
        </p>
        <p className="mt-1 text-xs leading-tight text-muted-foreground sm:text-sm">
          {label}
        </p>
      </div>
    </>
  );

  // Empilé (icône au-dessus) sur mobile pour tenir à 3 colonnes ; en ligne dès sm.
  const base =
    "flex flex-col items-center gap-2 rounded-2xl border px-2 py-3 sm:flex-row sm:gap-3 sm:px-4";

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`${base} w-full cursor-pointer transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`}
      >
        {inner}
      </button>
    );
  }

  return <div className={base}>{inner}</div>;
}

// Container de section (alertes actives / historique), calqué sur les vignettes
// de la page À propos : pastille d'icône + titre, contenu en dessous.
function SectionCard({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="gap-0 rounded-3xl border p-5 shadow-none sm:p-6">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          {icon}
        </div>
        <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
      </div>
      {children}
    </Card>
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
  const [parksOpen, setParksOpen] = useState(false);
  const [ridesOpen, setRidesOpen] = useState(false);
  // Compteurs des vignettes en direct depuis localStorage (source de travail des
  // favoris) : le nombre se met à jour immédiatement quand on retire un favori
  // depuis le popup, sans attendre un refresh du profil.
  const { favorites: parkFavorites } = useFavorites("parks");
  const { favorites: rideFavorites } = useFavorites("rides");

  // Garde côté client : si l'utilisateur se déconnecte depuis cette page, retour
  // à l'accueil (la garde serveur couvre l'accès direct sans session).
  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/");
    }
  }, [status, router]);

  // Session en cours de chargement : squelette (au lieu d'un écran vide).
  if (status === "loading") {
    return <ProfileSkeleton />;
  }
  // Déconnecté : l'effet ci-dessus renvoie à l'accueil ; on n'affiche rien.
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
          {/* Statistiques en tête de carte : parcs favoris, attractions favorites
              (cliquables -> popup avec retrait), alertes actives. */}
          <div className="grid grid-cols-3 gap-2 p-1 pb-3 sm:gap-4">
            <Stat
              icon={<FerrisWheel className="size-5" />}
              value={parkFavorites.size}
              max={PARK_FAVORITES_LIMIT}
              label={t("favoritesParksCount")}
              onClick={() => setParksOpen(true)}
            />
            <Stat
              icon={<Star className="size-5" />}
              value={rideFavorites.size}
              label={t("favoritesRidesCount")}
              onClick={() => setRidesOpen(true)}
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

            {/* Onglet 1 : notifications (actives + historique), chacune dans son
                propre container (même style « pastille d'icône + titre » que la
                page À propos). */}
            <TabsContent
              value="alerts"
              className="flex flex-col gap-4 p-2 pt-5 sm:p-4"
            >
              <SectionCard icon={<Bell className="size-5" />} title={t("alertsTitle")}>
                {/* Rappel : les alertes ne valent que pour la journée en cours. */}
                <p className="mb-4 text-sm text-muted-foreground">
                  {t("alertsDailyNote")}
                </p>
                <AlertsSection />
              </SectionCard>

              <SectionCard
                icon={<History className="size-5" />}
                title={t("historyTitle")}
              >
                <AlertHistorySection />
              </SectionCard>
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

      <FavoritesPopup scope="parks" open={parksOpen} onOpenChange={setParksOpen} />
      <FavoritesPopup scope="rides" open={ridesOpen} onOpenChange={setRidesOpen} />
    </div>
  );
}
