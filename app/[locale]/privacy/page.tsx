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
  const t = await getTranslations({ locale, namespace: "legal.privacy" });
  return { title: t("metaTitle"), robots: { index: false, follow: true } };
}

// Politique de confidentialité (RGPD art. 13). Contenu traduit via le namespace
// i18n `legal.privacy` (fr + en ; repli EN pour les autres langues).
export default async function ConfidentialitePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "legal" });
  const p = await getTranslations({ locale, namespace: "legal.privacy" });

  return (
    <LegalPage title={p("title")} updated={t("updated")} backLabel={t("backHome")}>
      <section>
        <p>{p.rich("intro", legalTags)}</p>
      </section>

      <section>
        <h2>{p("dataTitle")}</h2>
        <ul>
          <li>{p.rich("data1", legalTags)}</li>
          <li>{p.rich("data2", legalTags)}</li>
          <li>{p.rich("data3", legalTags)}</li>
          <li>{p.rich("data4", legalTags)}</li>
        </ul>
      </section>

      <section>
        <h2>{p("recipientsTitle")}</h2>
        <p>{p("recipients1")}</p>
        <p>{p("recipients2")}</p>
      </section>

      <section>
        <h2>{p("retentionTitle")}</h2>
        <ul>
          <li>{p("retention1")}</li>
          <li>{p("retention2")}</li>
          <li>{p("retention3")}</li>
          <li>{p("retention4")}</li>
        </ul>
      </section>

      <section>
        <h2>{p("rightsTitle")}</h2>
        <p>{p.rich("rights1", legalTags)}</p>
        <p>{p("rights2")}</p>
      </section>

      <section>
        <h2>{p("securityTitle")}</h2>
        <p>{p("security1")}</p>
      </section>
    </LegalPage>
  );
}
