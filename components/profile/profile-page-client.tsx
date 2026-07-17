"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { ArrowLeft, Star, Bell } from "lucide-react";
import { Link, useRouter } from "@/i18n/routing";
import { Card } from "@/components/ui/card";
import Footer from "@/components/ui/footer";
import { useUser } from "@/components/providers/user-provider";
import PreferencesCard from "./preferences-card";
import NotificationsSection from "./notifications-section";
import NotificationHistorySection from "./notification-history-section";

// Une statistique compacte (favoris / notifications actives).
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
    <Card className="flex-row items-center gap-3 px-5 py-4">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
        {icon}
      </div>
      <div>
        <p className="text-2xl font-bold leading-none">{value}</p>
        <p className="mt-1 text-sm text-muted-foreground">{label}</p>
      </div>
    </Card>
  );
}

export default function ProfilePageClient() {
  const t = useTranslations("profile");
  const { status, profile } = useUser();
  const router = useRouter();

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
    <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-8 px-3 py-8 sm:px-4">
      <main className="flex flex-1 flex-col gap-6">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex size-9 items-center justify-center rounded-full border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            aria-label={t("back")}
          >
            <ArrowLeft className="size-4" />
          </Link>
          <h1 className="text-2xl font-bold">{t("title")}</h1>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Stat
            icon={<Star className="size-5" />}
            value={profile?.counts.favorites ?? 0}
            label={t("favoritesCount")}
          />
          <Stat
            icon={<Bell className="size-5" />}
            value={profile?.counts.activeNotifications ?? 0}
            label={t("activeNotificationsCount")}
          />
        </div>

        <PreferencesCard />
        <NotificationsSection />
        <NotificationHistorySection />
      </main>
      <Footer />
    </div>
  );
}
