"use client";

import { useEffect, useState } from "react";
import { GoogleAnalytics as GA } from "@next/third-parties/google";
import { CONSENT_EVENT, readConsent } from "@/lib/cookie-consent";

// Google Analytics n'est chargé QU'APRÈS consentement explicite (cookies de
// mesure d'audience soumis à consentement — CNIL). Tant que l'utilisateur n'a pas
// accepté, aucun script GA ni cookie `_ga*` n'est déposé.
export function GoogleAnalytics() {
  const gaId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  const [granted, setGranted] = useState(false);

  useEffect(() => {
    setGranted(readConsent() === "granted");
    const onChange = (e: Event) => {
      setGranted((e as CustomEvent).detail === "granted");
    };
    window.addEventListener(CONSENT_EVENT, onChange);
    return () => window.removeEventListener(CONSENT_EVENT, onChange);
  }, []);

  if (!gaId || !granted) {
    return null;
  }

  return <GA gaId={gaId} />;
}
