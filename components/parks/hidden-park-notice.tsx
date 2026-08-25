import { EyeOff } from "lucide-react";

/**
 * Pastille « ce parc n'est pas public », affichée sur la page d'un parc dont
 * `display = false` — donc uniquement à un admin, seul à pouvoir l'ouvrir.
 *
 * Sans elle, rien à l'écran ne distingue un parc en ligne d'un parc que seul
 * l'auteur voit : on croirait la mise en ligne faite.
 *
 * ⚠️ **Flottante en bas, pas un bandeau en tête de page** : l'en-tête du parc est
 * `fixed` (z-50) et se rétracte au défilement en recouvrant le haut de la fenêtre
 * — un bandeau dans le flux passerait dessous, invisible, et décalerait le calcul
 * de hauteur du header.
 *
 * Texte NON traduit, volontairement : il ne s'adresse qu'aux admins, et lui
 * ouvrir un namespace next-intl imposerait de toucher quatorze fichiers de
 * messages pour une phrase que personne d'autre ne lira jamais.
 */
export default function HiddenParkNotice() {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-60 flex justify-center px-3">
      <div className="flex items-center gap-2 rounded-full border border-amber-500/40 bg-amber-500/15 px-4 py-2 text-sm text-amber-700 shadow-lg backdrop-blur-sm dark:text-amber-300">
        <EyeOff className="size-4 shrink-0" aria-hidden />
        <span>
          <strong className="font-medium">Hidden park</strong> — visible because
          your account is an admin.
        </span>
      </div>
    </div>
  );
}
