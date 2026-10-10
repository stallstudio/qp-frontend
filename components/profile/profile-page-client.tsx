"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Bell, SlidersHorizontal, FerrisWheel, Lock } from "lucide-react";
import { useRouter } from "@/i18n/routing";
import { useFavoritesContext } from "@/components/providers/favorites-provider";
import {
  PARK_FAVORITES_LIMIT,
  type FavNamespace,
  type PoiFavNamespace,
} from "@/lib/favorites-storage";
import { POI_KIND_ICONS, type PoiKind } from "@/lib/poi-kinds";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Footer from "@/components/ui/footer";
import ScrollShrinkHeader from "@/components/ui/scroll-shrink-header";
import { useUser } from "@/components/providers/user-provider";
import PreferencesCard from "./preferences-card";
import PrivacySection from "./privacy-section";
import AlertsSection from "./alerts-section";
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
  accent = "bg-primary/10 text-primary",
  onClick,
  className,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
  // Affiche « value/max » (le plafond en petit) : rappelle jusqu'où va la limite.
  max?: number;
  // Teinte de la pastille d'icône (une couleur par tuile pour égayer l'en-tête).
  accent?: string;
  onClick?: () => void;
  className?: string;
}) {
  const inner = (
    <>
      <div
        className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${accent}`}
      >
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
  const base = cn(
    "flex flex-col items-center gap-2 rounded-2xl border px-2 py-3 sm:flex-row sm:gap-3 sm:px-4",
    className,
  );

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

// En-tête léger de sous-section (alertes actives / historique) : plus de grosse
// carte englobante — chaque élément (alerte / entrée d'historique) est désormais
// sa propre petite carte (voir alerts-section / alert-history-section).
function SectionHeading({
  icon,
  title,
}: {
  icon: React.ReactNode;
  title: string;
}) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <span className="text-primary">{icon}</span>
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
    </div>
  );
}

// Les vignettes de favoris des familles de POI, dans l'ordre de la page d'un
// parc.
//
// ⚠️ **Attractions et spectacles toujours, les autres seulement quand elles ont
// au moins un favori.** Une vignette « 0 hôtel favori » ne dirait rien à
// personne, et quatre de plus repousseraient les alertes sous la ligne de
// flottaison du téléphone. Celles qu'on n'a jamais utilisées n'ont rien à
// rappeler ; celle qu'on vient de remplir apparaît.
const POI_STATS: {
  namespace: PoiFavNamespace;
  kind: PoiKind;
  always: boolean;
  countKey: string;
  accent: string;
}[] = [
  {
    namespace: "rides",
    kind: "ride",
    always: true,
    countKey: "favoritesRidesCount",
    accent: "bg-primary/10 text-primary",
  },
  {
    namespace: "shows",
    kind: "show",
    always: true,
    countKey: "favoritesShowsCount",
    accent: "bg-show/10 text-show",
  },
  {
    namespace: "restaurants",
    kind: "restaurant",
    always: false,
    countKey: "favoritesRestaurantsCount",
    accent: "bg-restaurant/10 text-restaurant",
  },
  {
    namespace: "shops",
    kind: "shop",
    always: false,
    countKey: "favoritesShopsCount",
    accent: "bg-shop/10 text-shop",
  },
  {
    namespace: "hotels",
    kind: "hotel",
    always: false,
    countKey: "favoritesHotelsCount",
    accent: "bg-hotel/10 text-hotel",
  },
  {
    namespace: "services",
    kind: "service",
    always: false,
    countKey: "favoritesServicesCount",
    accent: "bg-service/10 text-service",
  },
];

// Page profil, calquée sur la page « À propos » : header scroll-shrink partagé +
// carte à onglets (rounded-4xl, pastille coulissante). Deux onglets : Préférences
// et Notifications.
export default function ProfilePageClient() {
  const t = useTranslations("profile");
  const { status, profile } = useUser();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("alerts");
  // Le popup de favoris ouvert, et sur quel namespace. Retenu à part de
  // l'ouverture : il garde son contenu le temps de son animation de sortie.
  const [popupScope, setPopupScope] = useState<FavNamespace>("parks");
  const [popupOpen, setPopupOpen] = useState(false);
  const openPopup = (scope: FavNamespace) => {
    setPopupScope(scope);
    setPopupOpen(true);
  };
  // Compteurs des vignettes en direct depuis le provider des favoris : le nombre
  // se met à jour immédiatement quand on retire un favori depuis le popup, sans
  // attendre un refresh du profil.
  const { favorites } = useFavoritesContext();
  const poiStats = POI_STATS.filter(
    (stat) => stat.always || favorites[stat.namespace].size > 0,
  );
  // Parcs + familles + alertes. Sur deux colonnes, un nombre impair laisserait
  // la vignette des alertes seule sur sa ligne, à moitié vide : elle prend
  // alors toute la largeur.
  const statCount = poiStats.length + 2;

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
          {/* Statistiques en tête de carte : parcs puis favoris de chaque
              famille (cliquables -> popup avec retrait), alertes actives.

              Les colonnes s'adaptent au nombre de vignettes dès `sm` : quatre
              d'ordinaire, jusqu'à huit avec toutes les familles. */}
          <div className="grid grid-cols-2 gap-2 p-1 pb-3 sm:grid-cols-[repeat(auto-fit,minmax(9.5rem,1fr))] sm:gap-4">
            <Stat
              icon={<FerrisWheel className="size-5" />}
              value={favorites.parks.size}
              max={PARK_FAVORITES_LIMIT}
              label={t("favoritesParksCount", { count: favorites.parks.size })}
              accent="bg-amber-500/10 text-amber-600 dark:text-amber-400"
              onClick={() => openPopup("parks")}
            />
            {poiStats.map((stat) => {
              const Icon = POI_KIND_ICONS[stat.kind];
              const count = favorites[stat.namespace].size;
              return (
                <Stat
                  key={stat.namespace}
                  icon={<Icon className="size-5" />}
                  value={count}
                  label={t(stat.countKey, { count })}
                  accent={stat.accent}
                  onClick={() => openPopup(stat.namespace)}
                />
              );
            })}
            <Stat
              icon={<Bell className="size-5" />}
              value={profile?.counts.activeAlerts ?? 0}
              label={t("activeAlertsCount", {
                count: profile?.counts.activeAlerts ?? 0,
              })}
              // « Blanc » : pastille neutre (fond très léger, icône couleur du
              // texte) — lisible en clair comme en sombre.
              accent="bg-foreground/5 text-foreground"
              className={cn(statCount % 2 === 1 && "col-span-2 sm:col-span-1")}
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

            {/* Onglet 1 : notifications, en « fil unifié » — un seul composant
                gère les sous-onglets Actives / Historique et le filtre par type
                (Tout · Attractions · Spectacles). */}
            <TabsContent
              value="alerts"
              className="flex flex-col gap-6 p-2 pt-5 sm:p-4"
            >
              <section>
                <AlertsSection />
              </section>
            </TabsContent>

            {/* Onglet 2 : préférences + confidentialité (RGPD/CNIL). */}
            <TabsContent
              value="preferences"
              className="flex flex-col gap-6 p-2 pt-5 sm:p-4"
            >
              <section>
                <SectionHeading
                  icon={<SlidersHorizontal className="size-4" />}
                  title={t("preferencesTitle")}
                />
                <PreferencesCard />
              </section>

              <section>
                <SectionHeading
                  icon={<Lock className="size-4" />}
                  title={t("privacyTitle")}
                />
                <PrivacySection />
              </section>
            </TabsContent>
          </Tabs>
        </Card>
      </main>

      <Footer />

      <FavoritesPopup
        scope={popupScope}
        open={popupOpen}
        onOpenChange={setPopupOpen}
      />
    </div>
  );
}
