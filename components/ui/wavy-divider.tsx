import { cn } from "@/lib/utils";

// Ligne légèrement ondulée ambrée, tuilée horizontalement (SVG en background : se
// répète proprement à n'importe quelle largeur). Volontairement discrète :
// faible amplitude, trait fin, peu de hauteur.
const WAVE_SVG = encodeURIComponent(
  "<svg xmlns='http://www.w3.org/2000/svg' width='14' height='5' viewBox='0 0 14 5'>" +
    "<path d='M0 2.5 Q3.5 1 7 2.5 T14 2.5' fill='none' stroke='#f59e0b' stroke-width='1' stroke-opacity='0.6'/>" +
    "</svg>",
);

function WaveLine({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("block h-[5px] flex-1", className)}
      style={{
        backgroundImage: `url("data:image/svg+xml,${WAVE_SVG}")`,
        backgroundRepeat: "repeat-x",
        backgroundPosition: "center",
      }}
    />
  );
}

type WavyDividerProps = {
  // Petit texte discret centré dans le séparateur (ex. « Vos favoris »).
  label?: string;
  className?: string;
};

// Séparateur ondulé ambré discret, avec ou sans label. Encadre la section des
// favoris dans la liste.
export default function WavyDivider({ label, className }: WavyDividerProps) {
  if (!label) {
    return (
      <div className={cn("flex items-center py-1", className)}>
        <WaveLine />
      </div>
    );
  }
  return (
    <div className={cn("flex items-center gap-2 py-1", className)}>
      <WaveLine />
      <span className="shrink-0 text-[10px] font-medium tracking-wide text-amber-600/80 uppercase dark:text-amber-500/80">
        {label}
      </span>
      <WaveLine />
    </div>
  );
}
