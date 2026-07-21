import type { Metadata } from "next";
import LegalPage from "@/components/legal/legal-page";

export const metadata: Metadata = {
  title: "Politique de confidentialité",
  robots: { index: false, follow: true },
};

// Politique de confidentialité (RGPD art. 13). Contenu adapté aux traitements
// réels de l'app (comptes, favoris, alertes, rappels, push, mesure d'audience).
export default function ConfidentialitePage() {
  return (
    <LegalPage
      title="Politique de confidentialité"
      updated="Dernière mise à jour : 21 juillet 2026"
    >
      <section>
        <p>
          Cette politique décrit comment Queue Park traite vos données
          personnelles. Responsable de traitement : l&apos;éditeur du site (voir{" "}
          <a href="/mentions-legales">Mentions légales</a>), contact :{" "}
          <a href="mailto:contact@queue-park.com">contact@queue-park.com</a>.
        </p>
      </section>

      <section>
        <h2>Données traitées, finalités et bases légales</h2>
        <ul>
          <li>
            <strong>Compte</strong> (adresse e-mail, et le cas échéant nom et
            photo de profil via Google) : création et gestion de votre compte —
            <em> exécution du service / votre consentement</em>.
          </li>
          <li>
            <strong>Préférences</strong> (langue, thème, format horaire) et{" "}
            <strong>favoris</strong> (parcs, attractions, spectacles) :
            personnalisation de votre expérience — <em>exécution du service</em>.
          </li>
          <li>
            <strong>Alertes de temps d&apos;attente</strong> et{" "}
            <strong>rappels de spectacles</strong>, avec les{" "}
            <strong>abonnements de notification</strong> de vos appareils : vous
            envoyer les notifications demandées — <em>votre consentement</em>.
          </li>
          <li>
            <strong>Mesure d&apos;audience</strong> (Google Analytics) :
            statistiques de fréquentation — <em>votre consentement</em> (voir la{" "}
            <a href="/cookies">Politique cookies</a>).
          </li>
        </ul>
      </section>

      <section>
        <h2>Destinataires et sous-traitants</h2>
        <p>
          Vos données ne sont pas vendues. Elles sont traitées par des
          prestataires agissant pour notre compte : Google (authentification et
          mesure d&apos;audience), Resend (envoi d&apos;e-mails de connexion),
          IONOS (hébergement, Union européenne).
        </p>
        <p>
          Certains prestataires (Google, Resend) sont établis aux États-Unis ;
          les transferts éventuels sont encadrés par les mécanismes prévus par le
          RGPD (Data Privacy Framework et/ou clauses contractuelles types).
        </p>
      </section>

      <section>
        <h2>Durées de conservation</h2>
        <ul>
          <li>Données de compte : jusqu&apos;à la suppression du compte.</li>
          <li>
            Alertes : valables pour la journée en cours ; historique conservé 30
            jours.
          </li>
          <li>
            Rappels de spectacles : supprimés une fois la représentation passée.
          </li>
          <li>Sessions de connexion : selon la durée de validité de la session.</li>
        </ul>
      </section>

      <section>
        <h2>Vos droits</h2>
        <p>
          Vous disposez d&apos;un droit d&apos;accès, de rectification,
          d&apos;effacement, de portabilité, d&apos;opposition et de limitation.
          Depuis votre <a href="/profile">profil</a> (onglet Préférences →
          Confidentialité), vous pouvez directement modifier votre e-mail,
          télécharger vos données (JSON) et supprimer votre compte. Pour toute
          autre demande, écrivez à{" "}
          <a href="mailto:contact@queue-park.com">contact@queue-park.com</a>.
        </p>
        <p>
          Vous pouvez également introduire une réclamation auprès de la CNIL
          (cnil.fr).
        </p>
      </section>

      <section>
        <h2>Sécurité et mineurs</h2>
        <p>
          Les échanges sont chiffrés (HTTPS) et l&apos;authentification se fait
          sans mot de passe. Nous limitons les données collectées au strict
          nécessaire. Le service n&apos;est pas destiné aux mineurs de moins de 15
          ans sans l&apos;accord d&apos;un titulaire de l&apos;autorité parentale.
        </p>
      </section>
    </LegalPage>
  );
}
