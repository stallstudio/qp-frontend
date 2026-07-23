"use client";

import { createContext, useContext, useEffect, useState } from "react";

export type TemperatureUnit = "celsius" | "fahrenheit";

const STORAGE_KEY = "temperature-unit-preference";

// Par défaut : Celsius (choix produit). Contrairement au format horaire, on ne
// déduit rien du système (pas d'équivalent Intl fiable et universel).
const DEFAULT_UNIT: TemperatureUnit = "celsius";

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
}: {
  children: React.ReactNode;
}) {
  const [temperatureUnit, setTemperatureUnit] = useState<TemperatureUnit>(() => {
    if (typeof window === "undefined") return DEFAULT_UNIT;
    const stored = localStorage.getItem(STORAGE_KEY) as TemperatureUnit | null;
    if (stored === "celsius" || stored === "fahrenheit") return stored;
    return DEFAULT_UNIT;
  });

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as TemperatureUnit | null;
    if (stored !== "celsius" && stored !== "fahrenheit") {
      localStorage.setItem(STORAGE_KEY, DEFAULT_UNIT);
    }
  }, []);

  const toggleUnit = () => {
    const next: TemperatureUnit =
      temperatureUnit === "celsius" ? "fahrenheit" : "celsius";
    setTemperatureUnit(next);
    localStorage.setItem(STORAGE_KEY, next);
  };

  const setUnit = (unit: TemperatureUnit) => {
    setTemperatureUnit(unit);
    localStorage.setItem(STORAGE_KEY, unit);
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
