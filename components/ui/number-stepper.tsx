"use client";

import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type NumberStepperProps = {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  // Rendu de la valeur (ex. « 20 min »). Par défaut le nombre brut.
  format?: (value: number) => string;
  className?: string;
  "aria-label"?: string;
};

// Sélecteur numérique générique `[-] <valeur> [+]` avec bornes et pas
// configurables. Réutilisable (ici : seuil d'alerte, pas de 5 min).
export default function NumberStepper({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  disabled = false,
  format,
  className,
  "aria-label": ariaLabel,
}: NumberStepperProps) {
  const clamp = (n: number) => Math.min(max, Math.max(min, n));
  const decrement = () => onChange(clamp(value - step));
  const increment = () => onChange(clamp(value + step));

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 rounded-lg border bg-background p-1",
        className,
      )}
      role="group"
      aria-label={ariaLabel}
    >
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={decrement}
        disabled={disabled || value <= min}
        aria-label="−"
      >
        <Minus className="size-4" />
      </Button>
      <span
        className="min-w-16 text-center text-sm font-semibold tabular-nums select-none"
        aria-live="polite"
      >
        {format ? format(value) : value}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={increment}
        disabled={disabled || value >= max}
        aria-label="+"
      >
        <Plus className="size-4" />
      </Button>
    </div>
  );
}
