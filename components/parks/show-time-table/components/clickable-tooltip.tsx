"use client";

import { useState } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type ClickableTooltipProps = {
  children: React.ReactNode;
  content: string;
};

export function ClickableTooltip({ children, content }: ClickableTooltipProps) {
  const [open, setOpen] = useState(false);

  return (
    <Tooltip open={open} onOpenChange={setOpen}>
      <TooltipTrigger asChild onClick={() => setOpen((prev) => !prev)}>
        {children}
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">
        {content}
      </TooltipContent>
    </Tooltip>
  );
}
