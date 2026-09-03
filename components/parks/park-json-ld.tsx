import { DateTime } from "luxon";
import { getSiteUrl } from "@/lib/site-url";
import type { ParkLiveData } from "@/types/api";

// Types d'horaires qui ne décrivent pas une ouverture normale au public : les
// annoncer comme telles à Google serait trompeur.
//
// ⚠️ `event` en fait partie : publier « 19:00 – 01:00 » comme horaires
// d'ouverture d'un `AmusementPark` serait FAUX quand l'accès exige un autre
// billet — et c'est le cas de la majorité des événements (Traumatica, Halloween
// Horror Nights). L'exclusion est systématique plutôt que conditionnée à
// `separateTicket` : un moteur de recherche n'a pas de moyen de nuancer, et
// annoncer une ouverture inaccessible est une erreur plus coûteuse que taire une
// session accessible.
const EXCLUDED_HOUR_TYPES = new Set(["private_event", "sold_out", "event"]);

type ParkJsonLdProps = {
  park: ParkLiveData;
  city: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  locale: string;
  homeLabel: string;
};

/**
 * Données structurées (JSON-LD) de la page d'un parc.
 *
 * Google ne devine pas qu'une page décrit un parc d'attractions : le balisage le
 * lui dit explicitement, ce qui rend la page éligible aux résultats enrichis
 * (fil d'Ariane à la place de l'URL brute, rattachement au Knowledge Graph).
 *
 * Règle importante : on ne déclare QUE ce qui est réellement visible sur la
 * page — nom, localisation, image, horaires du jour. Baliser des informations
 * absentes de la page est considéré comme du spam par Google.
 */
export default function ParkJsonLd({
  park,
  city,
  country,
  latitude,
  longitude,
  locale,
  homeLabel,
}: ParkJsonLdProps) {
  const baseUrl = getSiteUrl();
  const url = `${baseUrl}/${locale}/park/${park.identifier}`;

  // Horaires du jour, convertis dans le fuseau du parc et au format attendu par
  // schema.org (`opens`/`closes` en HH:mm local + jour de la semaine).
  const openingHoursSpecification = park.openingHours
    .filter(
      (hour) =>
        !EXCLUDED_HOUR_TYPES.has(hour.type) && hour.openTime && hour.closeTime,
    )
    .map((hour) => {
      const open = DateTime.fromISO(String(hour.openTime)).setZone(
        park.timezone,
      );
      const close = DateTime.fromISO(String(hour.closeTime)).setZone(
        park.timezone,
      );
      if (!open.isValid || !close.isValid) return null;
      return {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: open.toFormat("cccc", { locale: "en" }),
        opens: open.toFormat("HH:mm"),
        closes: close.toFormat("HH:mm"),
      };
    })
    .filter((spec): spec is NonNullable<typeof spec> => spec !== null);

  const hasAddress = Boolean(city || country);

  const park_ = {
    "@context": "https://schema.org",
    "@type": "AmusementPark",
    name: park.name,
    url,
    ...(park.cover?.[0]?.url && { image: park.cover[0].url }),
    ...(hasAddress && {
      address: {
        "@type": "PostalAddress",
        ...(city && { addressLocality: city }),
        ...(country && { addressCountry: country }),
      },
    }),
    ...(latitude != null &&
      longitude != null && {
        geo: {
          "@type": "GeoCoordinates",
          latitude,
          longitude,
        },
      }),
    ...(openingHoursSpecification.length > 0 && { openingHoursSpecification }),
  };

  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: homeLabel,
        item: `${baseUrl}/${locale}`,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: park.name,
        item: url,
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      // Contenu contrôlé (données de notre base sérialisées en JSON), rendu par
      // le serveur : `JSON.stringify` échappe déjà les guillemets, et on neutralise
      // `<` pour qu'un nom de parc exotique ne puisse pas fermer la balise.
      dangerouslySetInnerHTML={{
        __html: JSON.stringify([park_, breadcrumb]).replace(/</g, "\\u003c"),
      }}
    />
  );
}
