import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type VignetteProps = {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
  /** Zone de démonstration facultative (mini-exemple vivant). */
  demo?: React.ReactNode;
  demoLabel?: string;
  /** La vignette occupe deux colonnes sur grand écran (ex. carte d'intro). */
  wide?: boolean;
  className?: string;
};

/**
 * Petite carte de la page « À propos » : une pastille d'icône, un titre, un
 * court paragraphe, et éventuellement un mini-exemple concret rendu avec les
 * vrais composants de l'app. Pensée pour être disposée en grille, pas en
 * colonne « journal ».
 */
export default function Vignette({
  icon: Icon,
  title,
  body,
  demo,
  demoLabel,
  wide,
  className,
}: VignetteProps) {
  return (
    <Card
      className={cn(
        "h-full gap-0 rounded-3xl p-5 sm:p-6",
        wide && "md:col-span-2",
        className,
      )}
    >
      <div className="mb-4 flex size-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Icon className="size-5" />
      </div>
      <h3 className="mb-2 text-lg font-semibold tracking-tight">{title}</h3>
      <p className="text-sm leading-relaxed text-muted-foreground">{body}</p>
      {demo && (
        <div className="mt-4 rounded-2xl border bg-muted/40 p-4">
          {demoLabel && (
            <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground/70">
              {demoLabel}
            </p>
          )}
          {demo}
        </div>
      )}
    </Card>
  );
}
