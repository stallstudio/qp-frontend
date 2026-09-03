"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import {
  OPEN_CONSENT_EVENT,
  readConsent,
  setConsent,
  type ConsentValue,
} from "@/lib/cookie-consent";

// Bandeau de consentement discret (bas de page). Ne s'affiche qu'au premier
// passage (pas de choix enregistré) ou quand l'utilisateur clique « Gérer les
// cookies ». Le refus est aussi simple que l'acceptation (exigence CNIL).
export default function CookieConsent() {
  const t = useTranslations("cookies");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (readConsent() === null) setOpen(true);
    const reopen = () => setOpen(true);
    window.addEventListener(OPEN_CONSENT_EVENT, reopen);
    return () => window.removeEventListener(OPEN_CONSENT_EVENT, reopen);
  }, []);

  if (!open) return null;

  const choose = (value: ConsentValue) => {
    setConsent(value);
    setOpen(false);
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 p-3 sm:p-4">
      <div className="mx-auto flex max-w-3xl flex-col gap-3 rounded-2xl border bg-background/95 p-4 shadow-lg backdrop-blur sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {t("message")}{" "}
          <Link
            href="/cookies"
            className="underline underline-offset-2 hover:text-foreground"
          >
            {t("learnMore")}
          </Link>
        </p>
        <div className="flex shrink-0 gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => choose("denied")}
            className="flex-1 sm:flex-none"
          >
            {t("refuse")}
          </Button>
          <Button
            size="sm"
            onClick={() => choose("granted")}
            className="flex-1 sm:flex-none"
          >
            {t("accept")}
          </Button>
        </div>
      </div>
    </div>
  );
}
