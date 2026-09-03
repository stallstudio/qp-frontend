import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { auth } from "@/auth";
import { redirect } from "@/i18n/routing";
import ProfilePageClient from "@/components/profile/profile-page-client";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "profile" });
  return {
    title: t("title"),
    // Page privée : hors indexation.
    robots: { index: false, follow: false },
  };
}

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  // Garde serveur : accès direct sans session -> retour à l'accueil.
  const session = await auth();
  if (!session?.user) {
    redirect({ href: "/", locale });
  }

  return <ProfilePageClient />;
}
