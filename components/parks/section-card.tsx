import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

type SectionCardProps = {
  /** Pictogramme de la famille de données (attractions, spectacles, …). */
  icon: LucideIcon;
  title: string;
  children: React.ReactNode;
  /**
   * Arrondis de la carte, imposés par la COLONNE qui l'empile — même contrat
   * qu'`EventCard` : la carte ignore sa place dans la pile.
   */
  className?: string;
};

/**
 * Carte TITRÉE de la colonne d'un parc : la cousine sobre d'`EventCard`.
 *
 * ⚠️ **Le titre nomme la SOURCE, pas l'onglet.** « Attractions », pas « Temps
 * d'attente » : l'onglet dit déjà quelle nature de donnée on regarde, la carte
 * dit d'où elle vient. La distinction n'a l'air de rien avec deux cartes, mais
 * c'est elle qui tiendra quand l'onglet « Temps d'attente » en portera quatre —
 * attractions, événement, restaurants, files virtuelles.
 *
 * `EventCard` ne s'en sert pas : son en-tête porte en plus un état (ouvre à…,
 * ferme à…), une teinte de famille et le repli. Les deux gardent en revanche la
 * MÊME géométrie d'en-tête (icône `size-5`, `gap-2.5`, `py-3`), pour que la
 * colonne ait un seul rythme.
 */
export default function SectionCard({
  icon: Icon,
  title,
  children,
  className,
}: SectionCardProps) {
  return (
    <Card
      className={cn(
        "w-full gap-0 rounded-4xl p-2.5 py-0 sm:p-4 sm:py-0",
        className,
      )}
    >
      {/* Pas de trait sous le titre, contrairement à `EventCard` : la ligne de
          libellés de colonnes qui suit porte déjà le sien (`border-b`), et deux
          filets à 40 px d'intervalle transformaient l'en-tête en boîte.
          `h3` : le nom du parc est le `h2` de la page (`header.tsx`). */}
      <div className="flex w-full items-center gap-2.5 py-3">
        <Icon className="size-5 shrink-0 text-muted-foreground" />
        <h3 className="min-w-0 flex-1 truncate font-semibold">{title}</h3>
      </div>
      <div className="pb-2">{children}</div>
    </Card>
  );
}
