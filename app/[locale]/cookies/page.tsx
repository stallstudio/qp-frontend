import type { Metadata } from "next";
import LegalPage from "@/components/legal/legal-page";

export const metadata: Metadata = {
  title: "Politique cookies",
  robots: { index: false, follow: true },
};

// Politique cookies. Distingue les cookies strictement nécessaires (exemptés de
// consentement) des cookies de mesure d'audience (soumis à consentement).
export default function CookiesPage() {
  return (
    <LegalPage title="Politique cookies" updated="Dernière mise à jour : 21 juillet 2026">
      <section>
        <p>
          Un cookie est un petit fichier déposé sur votre appareil lors de la
          visite d&apos;un site. Queue Park en utilise un minimum, décrits
          ci-dessous.
        </p>
      </section>

      <section>
        <h2>Cookies strictement nécessaires</h2>
        <p>
          Indispensables au fonctionnement du site, ils ne requièrent pas votre
          consentement :
        </p>
        <ul>
          <li>
            <strong>Session d&apos;authentification</strong> : vous maintient
            connecté à votre compte.
          </li>
          <li>
            <strong>Préférence de langue</strong> : mémorise la langue
            d&apos;affichage.
          </li>
        </ul>
      </section>

      <section>
        <h2>Cookies de mesure d&apos;audience</h2>
        <p>
          Nous utilisons Google Analytics pour comprendre la fréquentation du
          site et l&apos;améliorer. Ces cookies (par ex. <code>_ga</code>,{" "}
          <code>_ga_*</code>) ne sont déposés{" "}
          <strong>qu&apos;après votre consentement</strong> et sont conservés
          jusqu&apos;à 13 mois maximum.
        </p>
      </section>

      <section>
        <h2>Gérer votre choix</h2>
        <p>
          Vous pouvez accepter ou refuser ces cookies via le bandeau affiché lors
          de votre première visite, et modifier votre choix à tout moment grâce au
          lien <strong>« Gérer les cookies »</strong> en bas de page. Vous pouvez
          aussi configurer votre navigateur pour bloquer les cookies.
        </p>
      </section>
    </LegalPage>
  );
}
