// Slugs d'URL pour les pages attraction (`/park/{parc}/ride/{id}-{nom}`).
//
// L'IDENTIFIANT reste l'id numérique : c'est lui qui résout la page, le slug
// n'est qu'un habillage lisible (pour l'utilisateur ET pour le référencement,
// le nom de l'attraction apparaissant alors dans l'URL). Conséquence voulue :
// renommer une attraction ne casse aucun lien — l'ancienne URL redirige vers la
// nouvelle forme canonique.

const MAX_SLUG_LENGTH = 60;

/**
 * Transforme un libellé en segment d'URL. Renvoie une chaîne vide si le nom ne
 * contient aucun caractère latin (parcs japonais, coréens, chinois…) : dans ce
 * cas l'URL se réduit à l'id, ce qui reste parfaitement valide.
 */
export function slugify(value: string): string {
  return (
    value
      .normalize("NFD")
      // Retire les diacritiques (é -> e) une fois la décomposition faite.
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, MAX_SLUG_LENGTH)
      // Le `slice` peut couper juste après un tiret.
      .replace(/-+$/g, "")
  );
}

/** Forme canonique du segment d'URL d'une attraction. */
export function rideSlug(rideId: number, rideName: string): string {
  const suffix = slugify(rideName);
  return suffix ? `${rideId}-${suffix}` : String(rideId);
}

/**
 * Extrait l'id d'un segment d'URL. Tolérant par construction : `123`,
 * `123-space-mountain` et `123-ancien-nom` mènent tous à la même attraction
 * (la page redirige ensuite vers la forme canonique).
 */
export function parseRideSlug(slug: string): number | null {
  const match = /^(\d+)(?:-|$)/.exec(slug);
  if (!match) return null;
  const id = Number(match[1]);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}
