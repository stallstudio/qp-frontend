import { cache } from "react";
import { getPrisma } from "@/lib/prisma";

// Résolution d'UNE attraction, pour le lien profond `/park/{parc}/ride/{slug}`.
//
// L'attraction est résolue depuis la table `rides` et NON depuis les temps
// d'attente du moment : une attraction fermée pour la saison n'a plus aucune
// ligne `wait_times` active, et un lien partagé (ou une notification) ne doit pas
// pour autant tomber sur un 404.

export type RideIdentity = {
  id: number;
  name: string;
  thrillsId: string | null;
};

/**
 * Attraction affichable d'un parc donné. Le `parkId` est exigé : sans lui, l'id
 * d'une attraction d'un AUTRE parc ouvrirait un lien profond sur la mauvaise
 * URL (fuite inter-parcs).
 *
 * `null` = l'attraction n'existe pas / n'est plus active, `undefined` = base
 * injoignable — la distinction évite de transformer une panne en 404 définitive.
 * Mémoïsé pour la durée d'une requête : `generateMetadata`, la page et la
 * vignette de partage la demandent tous.
 */
export const getRideIdentity = cache(
  async (
    parkId: number,
    rideId: number,
  ): Promise<RideIdentity | null | undefined> => {
    try {
      const ride = await getPrisma().ride.findFirst({
        where: { id: rideId, parkId, active: true },
        select: { id: true, name: true, thrillsId: true },
      });
      return ride ?? null;
    } catch (error) {
      console.error(`Failed to load ride ${rideId}`, error);
      return undefined;
    }
  },
);

