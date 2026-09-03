import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import LegalPage from "@/components/legal/legal-page";
import { legalTags } from "@/components/legal/legal-tags";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "legal.cookies" });
  return { title: t("metaTitle"), robots: { index: false, follow: true } };
}

// Politique cookies. Distingue les cookies strictement nécessaires (exemptés de
// consentement) des cookies de mesure d'audience (soumis à consentement).
// Contenu traduit via le namespace i18n `legal.cookies`.
export default async function CookiesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "legal" });
  const c = await getTranslations({ locale, namespace: "legal.cookies" });

  return (
    <LegalPage title={c("title")} updated={t("updated")} backLabel={t("backHome")}>
      <section>
        <p>{c("intro")}</p>
      </section>

      <section>
        <h2>{c("necessaryTitle")}</h2>
        <p>{c("necessaryIntro")}</p>
        <ul>
          <li>{c.rich("necessary1", legalTags)}</li>
          <li>{c.rich("necessary2", legalTags)}</li>
        </ul>
      </section>

      <section>
        <h2>{c("audienceTitle")}</h2>
        <p>{c.rich("audience1", legalTags)}</p>
      </section>

      <section>
        <h2>{c("manageTitle")}</h2>
        <p>{c.rich("manage1", legalTags)}</p>
      </section>
    </LegalPage>
  );
}
