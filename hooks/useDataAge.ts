"use client";

import { useRef } from "react";

/**
 * Âge de la donnée affichée, en secondes, qui vieillit à chaque battement.
 *
 * Part de l'âge annoncé par le SERVEUR (`ParkLiveData.dataAgeSeconds`) et y
 * ajoute le temps écoulé depuis la réception.
 *
 * ⚠️ **Pourquoi ne pas simplement faire `Date.now() - lastUpdate` ?** Parce que
 * l'horloge du visiteur peut être décalée de plusieurs minutes, ce qui donnerait
 * un âge absurde — voire négatif. Une horloge fausse reste juste pour mesurer un
 * ÉCOULEMENT : on ne lui demande donc que ça, et le point de départ vient du
 * serveur.
 *
 * ⚠️ **Et pourquoi pas d'erreur d'hydratation ?** Au premier rendu, l'ancre est
 * posée dans le même souffle que la lecture : l'âge rendu vaut exactement
 * `serverAgeSeconds`, côté serveur comme côté navigateur.
 *
 * `tick` n'est pas lu, il est la dépendance de rendu : sans lui, la valeur ne
 * serait recalculée qu'au prochain changement de données.
 */
export function useDataAge(
  /** Identité de la donnée courante — son horodatage de collecte. Un changement
   *  repose l'ancre. */
  key: string,
  serverAgeSeconds: number,
  tick: number,
): number {
  const anchor = useRef({
    key,
    age: serverAgeSeconds,
    at: Date.now(),
  });

  // Réajustement pendant le rendu, sans effet ni re-rendu : la nouvelle donnée
  // doit être prise en compte MAINTENANT, pas au rendu suivant, sinon l'âge
  // affiché sauterait d'une seconde après chaque rafraîchissement.
  if (anchor.current.key !== key || anchor.current.age !== serverAgeSeconds) {
    anchor.current = { key, age: serverAgeSeconds, at: Date.now() };
  }

  void tick;

  const elapsed = (Date.now() - anchor.current.at) / 1000;
  return Math.max(0, Math.round(anchor.current.age + elapsed));
}
