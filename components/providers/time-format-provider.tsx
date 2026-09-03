"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useLocale } from "next-intl";

export type TimeFormatType = "12h" | "24h";

const STORAGE_KEY = "time-format-preference";

/**
 * ⚠️ **`localStorage` peut LEVER, pas seulement rendre `null`** : navigation
 * privée, stockage désactivé, page servie dans une iframe tierce. Une exception
 * ici emporterait le provider, donc l'application entière — pour une préférence
 * d'affichage. Les deux accès sont donc protégés, et l'absence de stockage
 * dégrade proprement vers le défaut.
 */
function readStored(): TimeFormatType | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === "12h" || stored === "24h" ? stored : null;
  } catch {
    return null;
  }
}

function writeStored(format: TimeFormatType): void {
  try {
    localStorage.setItem(STORAGE_KEY, format);
  } catch {
    // Rien à faire : la préférence ne survivra pas au rechargement, la page
    // fonctionne pour autant.
  }
}

type TimeFormatContextType = {
  timeFormat: TimeFormatType;
  toggleTimeFormat: () => void;
  setFormat: (format: TimeFormatType) => void;
  is12Hour: boolean;
  is24Hour: boolean;
};

const TimeFormatContext = createContext<TimeFormatContextType | undefined>(
  undefined,
);

export function TimeFormatProvider({
  children,
  defaultFormat = "24h",
}: {
  children: React.ReactNode;
  /**
   * Le format déduit de la REQUÊTE (pays, `Accept-Language`, locale de l'URL),
   * calculé par le layout — voir `lib/regional-defaults.ts`.
   */
  defaultFormat?: TimeFormatType;
}) {
  /**
   * ⚠️ **Le premier rendu vaut `defaultFormat`, serveur ET navigateur.**
   *
   * L'initialiseur de `useState` lisait `localStorage` : le serveur rendait
   * « 24h » pendant que le client rendait « 12h » DÈS SON PREMIER RENDU, et tout
   * horaire de la page divergeait entre les deux — l'erreur d'hydratation « some
   * attributes of the server rendered HTML didn't match ». React n'y remédie pas
   * silencieusement : il jette le HTML servi et re-rend l'arbre, ce qui coûte
   * bien plus que le réglage qu'on croyait économiser.
   *
   * Passer le défaut en PROP résout les deux problèmes d'un coup : les deux
   * rendus partent de la même valeur, et cette valeur est déjà la bonne pour qui
   * n'a jamais touché au réglage — donc pas de bascule visible non plus.
   */
  const [timeFormat, setTimeFormat] = useState<TimeFormatType>(defaultFormat);

  /**
   * Un choix EXPLICITE l'emporte sur la déduction, et lui seul.
   *
   * ⚠️ **On ne grave plus le défaut au premier passage**, contrairement à avant.
   * Le stockage veut désormais dire « le visiteur a choisi », pas « on a deviné
   * un jour » : sinon un premier verdict approximatif — servi avant que
   * l'en-tête de géolocalisation ne soit en place, par exemple — serait figé
   * pour toujours, et une amélioration de la déduction n'atteindrait plus
   * personne.
   */
  useEffect(() => {
    const stored = readStored();
    if (stored) setTimeFormat(stored);
  }, []);

  const toggleTimeFormat = () => {
    const newFormat: TimeFormatType = timeFormat === "12h" ? "24h" : "12h";
    setTimeFormat(newFormat);
    writeStored(newFormat);
  };

  const setFormat = (format: TimeFormatType) => {
    setTimeFormat(format);
    writeStored(format);
  };

  const value = {
    timeFormat,
    toggleTimeFormat,
    setFormat,
    is12Hour: timeFormat === "12h",
    is24Hour: timeFormat === "24h",
  };

  return (
    <TimeFormatContext.Provider value={value}>
      {children}
    </TimeFormatContext.Provider>
  );
}

export function useTimeFormatContext() {
  const context = useContext(TimeFormatContext);
  if (context === undefined) {
    throw new Error(
      "useTimeFormatContext must be used within a TimeFormatProvider",
    );
  }
  return context;
}
