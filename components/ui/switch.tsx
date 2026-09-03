"use client"

import * as React from "react"
import { Switch as SwitchPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

function Switch({
  className,
  size = "default",
  checkedIcon,
  uncheckedIcon,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root> & {
  size?: "sm" | "default" | "lg"
  // Icônes affichées DANS le pouce et permutées selon l'état (ex. cloche
  // active / cloche barrée). Optionnelles : sans elles, pouce nu (rétro-compat).
  checkedIcon?: React.ReactNode
  uncheckedIcon?: React.ReactNode
}) {
  const hasIcon = checkedIcon != null || uncheckedIcon != null
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      data-size={size}
      className={cn(
        "peer data-[state=checked]:bg-primary data-[state=unchecked]:bg-input focus-visible:border-ring focus-visible:ring-ring/50 dark:data-[state=unchecked]:bg-input/80 group/switch inline-flex shrink-0 items-center rounded-full border border-transparent shadow-xs transition-all outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 data-[size=default]:h-[1.15rem] data-[size=default]:w-8 data-[size=sm]:h-3.5 data-[size=sm]:w-6 data-[size=lg]:h-6 data-[size=lg]:w-10",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "bg-background dark:data-[state=unchecked]:bg-foreground dark:data-[state=checked]:bg-primary-foreground pointer-events-none relative flex items-center justify-center rounded-full ring-0 transition-transform group-data-[size=default]/switch:size-4 group-data-[size=sm]/switch:size-3 group-data-[size=lg]/switch:size-5 data-[state=checked]:translate-x-[calc(100%-2px)] data-[state=unchecked]:translate-x-0"
        )}
      >
        {hasIcon && (
          <>
            {/* Les deux icônes se superposent au centre du pouce et se
                fondent selon l'état (lecture via le groupe /switch). */}
            <span className="absolute inset-0 flex items-center justify-center text-primary opacity-0 transition-opacity duration-150 group-data-[state=checked]/switch:opacity-100 [&_svg]:size-3">
              {checkedIcon}
            </span>
            <span className="absolute inset-0 flex items-center justify-center text-muted-foreground opacity-100 transition-opacity duration-150 group-data-[state=checked]/switch:opacity-0 [&_svg]:size-3">
              {uncheckedIcon}
            </span>
          </>
        )}
      </SwitchPrimitive.Thumb>
    </SwitchPrimitive.Root>
  )
}

export { Switch }
