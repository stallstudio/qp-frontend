import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/routing";
import AccessGate from "@/components/access/access-gate";
import { ACCESS_COOKIE, getAccessCode, hasAccess } from "@/lib/access-gate";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "accessGate" });

  return {
    title: t("metaTitle"),
    robots: { index: false, follow: false },
  };
}

/**
 * L'écran d'accès. On n'y arrive normalement PAS par son URL : `middleware.ts`
 * le sert par réécriture à la place de n'importe quelle page tant que le
 * visiteur n'a pas le cookie. L'adresse demandée reste donc dans la barre, et
 * le rechargement qui suit le bon code affiche directement la bonne page.
 *
 * Atteint en direct, il n'a de sens que verrou posé et cookie absent.
 */
export default async function AccessPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const code = getAccessCode();
  if (!code) notFound();

  if (hasAccess((await cookies()).get(ACCESS_COOKIE)?.value)) {
    redirect({ href: "/", locale });
  }

  return <AccessGate length={code.length} />;
}
