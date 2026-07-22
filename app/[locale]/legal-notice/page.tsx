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
  const t = await getTranslations({ locale, namespace: "legal.legalNotice" });
  return { title: t("metaTitle"), robots: { index: false, follow: true } };
}

// Mentions légales (LCEN art. 6). Contenu traduit via `legal.legalNotice`.
export default async function MentionsLegalesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "legal" });
  const m = await getTranslations({ locale, namespace: "legal.legalNotice" });

  return (
    <LegalPage title={m("title")} updated={t("updated")} backLabel={t("backHome")}>
      <section>
        <h2>{m("editorTitle")}</h2>
        <p>{m("editor1")}</p>
        <p>{m.rich("editor2", legalTags)}</p>
      </section>

      <section>
        <h2>{m("hostingTitle")}</h2>
        <p>{m("hosting1")}</p>
      </section>

      <section>
        <h2>{m("ipTitle")}</h2>
        <p>{m("ip1")}</p>
      </section>

      <section>
        <h2>{m("liabilityTitle")}</h2>
        <p>{m("liability1")}</p>
      </section>
    </LegalPage>
  );
}
