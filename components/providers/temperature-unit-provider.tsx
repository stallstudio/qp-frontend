"use client";

import { createContext, useContext, useEffect, useState } from "react";

export type TemperatureUnit = "celsius" | "fahrenheit";

const STORAGE_KEY = "temperature-unit-preference";

// Par défaut : Celsius (choix produit). Contrairement au format horaire, on ne
// déduit rien du système (pas d'équivalent Intl fiable et universel).
//
// ⚠️ C'est donc AUSSI ce que rend le serveur, et le premier rendu du client —
// voir `TemperatureUnitProvider`.
const DEFAULT_UNIT: TemperatureUnit = "celsius";

/**
 * ⚠️ **`localStorage` peut LEVER, pas seulement rendre `null`** : navigation
 * privée, stockage désactivé, page servie dans une iframe tierce. Une exception
 * emporterait le provider, donc l'application — pour une unité d'affichage.
 */
function readStored(): TemperatureUnit | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === "celsius" || stored === "fahrenheit" ? stored : null;
  } catch {
    return null;
  }
}

function writeStored(unit: TemperatureUnit): void {
  try {
    localStorage.setItem(STORAGE_KEY, unit);
  } catch {
    // La préférence ne survivra pas au rechargement ; la page fonctionne.
  }
}

type TemperatureUnitContextType = {
  temperatureUnit: TemperatureUnit;
  toggleUnit: () => void;
  setUnit: (unit: TemperatureUnit) => void;
  isCelsius: boolean;
  isFahrenheit: boolean;
};

const TemperatureUnitContext = createContext<
  TemperatureUnitContextType | undefined
>(undefined);

export function TemperatureUnitProvider({
  children,
  defaultUnit = DEFAULT_UNIT,
}: {
  children: React.ReactNode;
  /**
   * L'unité déduite de la REQUÊTE (pays, `Accept-Language`), calculée par le
   * layout — voir `lib/regional-defaults.ts`.
   */
  defaultUnit?: TemperatureUnit;
}) {
  /**
   * ⚠️ **Le premier rendu vaut `defaultUnit`, serveur ET navigateur.**
   *
   * Même correction que `TimeFormatProvider`, et pour la même raison : lire
   * `localStorage` dans l'initialiseur de `useState` faisait rendre au client,
   * dès son PREMIER rendu, autre chose que ce que le serveur avait servi. Toute
   * température de la page divergeait alors entre les deux, et React ne recolle
   * pas : il jette le HTML servi et re-rend l'arbre entier.
   *
   * Le défaut vient du PAYS du visiteur quand on le connaît (voir
   * `lib/regional-defaults.ts`) : un Américain voit des Fahrenheit dès la
   * première image, sans bascule.
   */
  const [temperatureUnit, setTemperatureUnit] =
    useState<TemperatureUnit>(defaultUnit);

  /**
   * ⚠️ **On ne grave plus le défaut au premier passage.** Le stockage veut
   * désormais dire « le visiteur a choisi », pas « on a deviné un jour » —
   * sinon un Celsius servi avant que la géolocalisation ne soit en place
   * resterait gravé chez un Américain pour toujours.
   */
  useEffect(() => {
    const stored = readStored();
    if (stored) setTemperatureUnit(stored);
  }, []);

  const toggleUnit = () => {
    const next: TemperatureUnit =
      temperatureUnit === "celsius" ? "fahrenheit" : "celsius";
    setTemperatureUnit(next);
    writeStored(next);
  };

  const setUnit = (unit: TemperatureUnit) => {
    setTemperatureUnit(unit);
    writeStored(unit);
  };

  const value = {
    temperatureUnit,
    toggleUnit,
    setUnit,
    isCelsius: temperatureUnit === "celsius",
    isFahrenheit: temperatureUnit === "fahrenheit",
  };

  return (
    <TemperatureUnitContext.Provider value={value}>
      {children}
    </TemperatureUnitContext.Provider>
  );
}

export function useTemperatureUnitContext() {
  const context = useContext(TemperatureUnitContext);
  if (context === undefined) {
    throw new Error(
      "useTemperatureUnitContext must be used within a TemperatureUnitProvider",
    );
  }
  return context;
}
