import { ComponentPropsWithoutRef } from "react"

import { cn } from "@/lib/utils"

export interface AnimatedGradientTextProps extends ComponentPropsWithoutRef<"div"> {
  speed?: number
  colorFrom?: string
  colorTo?: string
  /**
   * Durée d'un balayage, en secondes (défaut : les 8 s de `--animate-gradient`
   * dans `globals.css`).
   *
   * ⚠️ C'est le SEUL réglage qui change la cadence. `speed` élargit le dégradé
   * — donc la bande claire va plus vite, mais il y a toujours exactement un
   * balayage par cycle, puisque `--bg-size` sert à la fois de largeur de motif
   * et de distance parcourue par les keyframes.
   */
  duration?: number
}

export function AnimatedGradientText({
  children,
  className,
  speed = 1,
  colorFrom = "#ffaa40",
  colorTo = "#9c40ff",
  duration,
  ...props
}: AnimatedGradientTextProps) {
  return (
    <span
      style={
        {
          "--bg-size": `${speed * 300}%`,
          "--color-from": colorFrom,
          "--color-to": colorTo,
          ...(duration != null && { animationDuration: `${duration}s` }),
        } as React.CSSProperties
      }
      className={cn(
        `animate-gradient inline bg-gradient-to-r from-[var(--color-from)] via-[var(--color-to)] to-[var(--color-from)] bg-[length:var(--bg-size)_100%] bg-clip-text text-transparent`,
        className
      )}
      {...props}
    >
      {children}
    </span>
  )
}
