import type { Metadata } from "next";
import LegalPage from "@/components/legal/legal-page";

export const metadata: Metadata = {
  title: "Mentions légales",
  robots: { index: false, follow: true },
};

// Mentions légales (LCEN art. 6).
export default function MentionsLegalesPage() {
  return (
    <LegalPage title="Mentions légales" updated="Dernière mise à jour : 21 juillet 2026">
      <section>
        <h2>Éditeur</h2>
        <p>
          Le site Queue Park (queue-park.com) est édité par Lilian G. et Gaspard D.
        </p>
        <p>
          Responsable de la publication : Lilian G. Contact :{" "}
          <a href="mailto:contact@queue-park.com">contact@queue-park.com</a>.
        </p>
      </section>

      <section>
        <h2>Hébergement</h2>
        <p>
          Le site est hébergé par IONOS SARL, 7, place de la Gare, BP 70109, 57201 SARREGUEMINES Cedex, France (ionos.fr).
        </p>
      </section>

      <section>
        <h2>Propriété intellectuelle</h2>
        <p>
          La structure, les textes et les éléments graphiques du site sont la
          propriété de leur éditeur, sauf mention contraire. Toute reproduction
          non autorisée est interdite. Les noms de parcs, d&apos;attractions et de
          spectacles appartiennent à leurs titulaires respectifs.
        </p>
      </section>

      <section>
        <h2>Responsabilité</h2>
        <p>
          Les temps d&apos;attente et horaires de spectacles sont fournis à titre
          indicatif, à partir de sources tierces, sans garantie d&apos;exactitude
          ou de disponibilité. L&apos;éditeur ne saurait être tenu responsable
          d&apos;un préjudice lié à leur utilisation.
        </p>
      </section>
    </LegalPage>
  );
}
