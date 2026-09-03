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
  // Liste EXPLICITE des valeurs sélectionnables. Si fournie, le +/- navigue de
  // proche en proche dans cette liste (pas nécessairement à pas constant) et
  // `min`/`max`/`step` sont ignorés — ex. seuils d'alerte [0, 1, 5, 10, …].
  values?: number[];
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
  values,
  disabled = false,
  format,
  className,
  "aria-label": ariaLabel,
}: NumberStepperProps) {
  // Index courant quand on travaille sur une liste explicite : la valeur exacte
  // si elle y figure, sinon la borne la plus proche (garde le stepper cohérent).
  const currentIndex = values
    ? (() => {
        const exact = values.indexOf(value);
        if (exact !== -1) return exact;
        let best = 0;
        for (let i = 1; i < values.length; i++) {
          if (Math.abs(values[i] - value) < Math.abs(values[best] - value)) {
            best = i;
          }
        }
        return best;
      })()
    : -1;

  const atMin = values ? currentIndex <= 0 : value <= min;
  const atMax = values ? currentIndex >= values.length - 1 : value >= max;

  const clamp = (n: number) => Math.min(max, Math.max(min, n));
  const decrement = () =>
    onChange(values ? values[Math.max(0, currentIndex - 1)] : clamp(value - step));
  const increment = () =>
    onChange(
      values
        ? values[Math.min(values.length - 1, currentIndex + 1)]
        : clamp(value + step),
    );

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
        disabled={disabled || atMin}
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
        disabled={disabled || atMax}
        aria-label="+"
      >
        <Plus className="size-4" />
      </Button>
    </div>
  );
}
