"use client";

import { useState } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type ClickableTooltipProps = {
  children: React.ReactNode;
  content: React.ReactNode;
  className?: string;
};

/**
 * Tooltip utilisable AU TACT autant qu'au survol : le clic bascule l'ouverture,
 * sans quoi l'info serait inaccessible sur mobile (aucun `hover`). Embarque son
 * propre `TooltipProvider` pour être posable n'importe où sans dépendre d'un
 * provider global.
 */
export function ClickableTooltip({
  children,
  content,
  className,
}: ClickableTooltipProps) {
  const [open, setOpen] = useState(false);

  return (
    <TooltipProvider delayDuration={0}>
      <Tooltip open={open} onOpenChange={setOpen}>
        <TooltipTrigger asChild onClick={() => setOpen((prev) => !prev)}>
          {children}
        </TooltipTrigger>
        <TooltipContent side="top" className={className ?? "text-xs"}>
          {content}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
