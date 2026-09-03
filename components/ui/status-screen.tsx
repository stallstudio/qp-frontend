import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";

type StatusScreenProps = {
  icon: LucideIcon;
  title: string;
  message: string;
  // Actions rendues sous le message (boutons / liens déjà stylés par l'appelant).
  children?: React.ReactNode;
};

/**
 * Écran plein pour les états « la page ne peut pas s'afficher » (404, erreur de
 * rendu). Factorisé pour que `not-found`, `error` et `global-error` partagent la
 * même présentation que le reste du site (carte arrondie, typographie, thème).
 */
export default function StatusScreen({
  icon: Icon,
  title,
  message,
  children,
}: StatusScreenProps) {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col items-center justify-center px-4">
      <Card className="w-full items-center rounded-4xl px-6 py-10 text-center">
        <Icon className="size-10 text-muted-foreground" />
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="max-w-md text-muted-foreground">{message}</p>
        {children && (
          <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
            {children}
          </div>
        )}
      </Card>
    </div>
  );
}
