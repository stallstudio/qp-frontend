"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useLocale } from "next-intl";

export type TimeFormatType = "12h" | "24h";

const STORAGE_KEY = "time-format-preference";

function detectSystemTimeFormat(locale: string): TimeFormatType {
  if (typeof window === "undefined") return "24h";

  try {
    const userLocale = locale || navigator.language;
    const resolved = new Intl.DateTimeFormat(userLocale, {
      hour: "numeric",
    }).resolvedOptions();

    return resolved.hour12 ? "12h" : "24h";
  } catch {
    return "24h";
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

export function TimeFormatProvider({ children }: { children: React.ReactNode }) {
  const locale = useLocale();
  const [timeFormat, setTimeFormat] = useState<TimeFormatType>(() => {
    if (typeof window === "undefined") return "24h";

    const stored = localStorage.getItem(STORAGE_KEY) as TimeFormatType | null;
    if (stored === "12h" || stored === "24h") {
      return stored;
    }

    return detectSystemTimeFormat(locale);
  });

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as TimeFormatType | null;
    if (!stored) {
      const detected = detectSystemTimeFormat(locale);
      setTimeFormat(detected);
      localStorage.setItem(STORAGE_KEY, detected);
    }
  }, [locale]);

  const toggleTimeFormat = () => {
    const newFormat: TimeFormatType = timeFormat === "12h" ? "24h" : "12h";
    setTimeFormat(newFormat);
    localStorage.setItem(STORAGE_KEY, newFormat);
  };

  const setFormat = (format: TimeFormatType) => {
    setTimeFormat(format);
    localStorage.setItem(STORAGE_KEY, format);
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
