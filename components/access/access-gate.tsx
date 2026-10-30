"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Check, Loader2, Lock } from "lucide-react";
import LanguageSwitcher from "@/components/ui/language-switcher";
import { AnimatedThemeToggler } from "@/components/ui/animated-theme-toggler";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Phase = "typing" | "checking" | "rejected" | "open";
type Problem = "wrong" | "throttled" | "failed";

// Le temps de voir les cases trembler en rouge avant qu'elles ne se vident, et
// celui de les voir passer au vert avant le rechargement.
const REJECT_MS = 500;
const OPEN_MS = 700;

/**
 * L'écran d'accès, dessiné comme un BILLET D'ENTRÉE : la face reprend la
 * bannière de l'accueil (même photo, mêmes dégradés, même titre ferré en bas à
 * gauche), une perforation la sépare du talon où l'on saisit le code.
 *
 * Une seule `<input>` transparente posée sur les cases : c'est elle qui reçoit
 * la frappe, le collage et le remplissage automatique (`one-time-code`) ; les
 * cases ne font que l'afficher. Le code part tout seul dès la dernière case
 * remplie, il n'y a donc pas de bouton.
 */
export default function AccessGate({ length }: { length: number }) {
  const t = useTranslations("accessGate");
  const tHome = useTranslations("home");
  const [code, setCode] = useState("");
  const [phase, setPhase] = useState<Phase>("typing");
  const [problem, setProblem] = useState<Problem | null>(null);
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const submit = async (value: string) => {
    setPhase("checking");
    let outcome: Problem;
    try {
      const response = await fetch("/api/access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: value }),
      });
      if (response.ok) {
        setPhase("open");
        // La même URL sert cette fois la vraie page : `middleware.ts` voit le
        // cookie et ne réécrit plus.
        setTimeout(() => window.location.reload(), OPEN_MS);
        return;
      }
      outcome = response.status === 429 ? "throttled" : "wrong";
    } catch {
      outcome = "failed";
    }

    setProblem(outcome);
    setPhase("rejected");
    setTimeout(() => {
      setCode("");
      setPhase("typing");
      inputRef.current?.focus();
    }, REJECT_MS);
  };

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value.replace(/\D/g, "").slice(0, length);
    setCode(value);
    setProblem(null);
    if (value.length === length) void submit(value);
  };

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-md flex-col items-center justify-center gap-6 px-4 py-10">
      <div className="relative w-full motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4 motion-safe:duration-500">
        <div className="rounded-4xl border bg-card shadow-sm">
          {/* Face : la bannière de l'accueil, en réduction. */}
          <div className="relative h-44 overflow-hidden rounded-t-[calc(2rem-1px)]">
            <Image
              src="/default_cover.webp"
              alt=""
              fill
              sizes="(max-width: 448px) 100vw, 448px"
              className="object-cover"
              priority
            />
            <div className="absolute inset-0 bg-linear-to-r from-black/80 via-black/45 to-black/20" />
            <div className="absolute inset-0 bg-linear-to-t from-black/40 via-transparent to-black/20" />

            {/* Même verre dépoli que la pastille « compte » de l'accueil. */}
            <span className="absolute left-4 top-4 flex h-8 items-center gap-1.5 rounded-full bg-black/25 px-2.5 text-sm font-medium text-white shadow-sm backdrop-blur-sm">
              <Lock className="size-4" />
              {t("badge")}
            </span>

            <div className="absolute inset-x-0 bottom-0 p-4">
              <h1 className="mb-1 text-3xl font-bold text-white">
                {tHome("title")}
              </h1>
              <p className="text-sm text-balance text-white/90">
                {tHome("subtitle")}
              </p>
            </div>
          </div>

          <p className="px-6 pt-5 pb-6 text-center text-sm text-pretty text-muted-foreground">
            {t("description")}
          </p>

          <Perforation />

          {/* Talon : le code. */}
          <div className="flex flex-col items-center gap-4 px-6 pt-6 pb-4">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
              {t("codeLabel")}
            </p>

            <div className="relative">
              <input
                ref={inputRef}
                value={code}
                onChange={handleChange}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                readOnly={phase !== "typing"}
                inputMode="numeric"
                pattern="\d*"
                autoComplete="one-time-code"
                maxLength={length}
                autoFocus
                aria-label={t("inputLabel", { length })}
                aria-invalid={problem === "wrong"}
                aria-describedby="access-status"
                // `text-base` : sous 16 px, Safari iOS zoome sur le champ au
                // focus, même invisible.
                className="absolute inset-0 z-10 w-full cursor-text text-base text-transparent caret-transparent opacity-0 outline-none selection:bg-transparent"
              />
              <div
                aria-hidden
                className={cn(
                  "flex gap-3",
                  phase === "rejected" && "motion-safe:animate-shake",
                )}
              >
                {Array.from({ length }, (_, index) => {
                  const digit = code[index];
                  const active =
                    focused && phase === "typing" && index === code.length;

                  return (
                    <div
                      key={index}
                      className={cn(
                        "flex size-14 items-center justify-center rounded-2xl border bg-background text-2xl font-semibold tabular-nums shadow-xs transition-[color,background-color,border-color,box-shadow] duration-200 dark:bg-input/30",
                        active && "border-primary ring-[3px] ring-primary/20",
                        phase === "rejected" &&
                          "border-destructive text-destructive ring-[3px] ring-destructive/15",
                        phase === "open" &&
                          "border-green-500 bg-green-500/10 text-green-600 dark:bg-green-500/15 dark:text-green-400",
                      )}
                      // Au bon code, les cases passent au vert l'une après
                      // l'autre, de gauche à droite.
                      style={{
                        transitionDelay:
                          phase === "open" ? `${index * 70}ms` : undefined,
                      }}
                    >
                      {digit ? (
                        <span className="motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-75 motion-safe:duration-150">
                          {digit}
                        </span>
                      ) : (
                        active && (
                          <span className="h-7 w-px bg-foreground motion-safe:animate-caret-blink" />
                        )
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <p
              id="access-status"
              aria-live="polite"
              className={cn(
                "flex h-5 items-center gap-1.5 text-sm",
                problem ? "text-destructive" : "text-muted-foreground",
                phase === "open" && "text-green-600 dark:text-green-400",
              )}
            >
              {phase === "checking" && (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  {t("checking")}
                </>
              )}
              {phase === "open" && (
                <>
                  <Check className="size-4" />
                  {t("open")}
                </>
              )}
              {phase !== "checking" && phase !== "open" && problem && t(problem)}
            </p>
          </div>
        </div>
      </div>

      {/* « Écrivez-nous à … » forme un bloc : sur un téléphone il passe à la
          ligne d'un seul tenant, au lieu de se couper au trait d'union de
          « Écrivez-nous » ou de l'adresse. */}
      <p className="text-center text-sm text-muted-foreground">
        {t("noCode")}{" "}
        <span className="inline-block">
          {t("writeUs")}{" "}
          <a
            href="mailto:contact@queue-park.com"
            className="font-medium whitespace-nowrap text-foreground underline-offset-4 transition-colors hover:text-primary hover:underline"
          >
            contact@queue-park.com
          </a>
        </span>
      </p>

      <div className="flex items-center gap-2">
        <LanguageSwitcher />
        <AnimatedThemeToggler
          className={buttonVariants({ variant: "secondary" })}
        />
      </div>
    </main>
  );
}

/**
 * La ligne de perforation du billet, avec ses deux encoches.
 *
 * ⚠️ Chaque encoche est un disque À LA COULEUR DU FOND posé à cheval sur la
 * bordure de la carte, puis rogné de sa moitié extérieure. Rogné à 50 % pile,
 * il laisserait passer le trait de bordure de la carte au milieu de l'encoche :
 * on garde donc 1 px de plus, qui recouvre ce trait.
 */
function Perforation() {
  return (
    <div className="relative" aria-hidden>
      <span className="absolute -left-3 top-px size-6 -translate-y-1/2 rounded-full border bg-background [clip-path:inset(0_0_0_calc(50%-1px))]" />
      <div className="mx-5 border-t-2 border-dashed" />
      <span className="absolute -right-3 top-px size-6 -translate-y-1/2 rounded-full border bg-background [clip-path:inset(0_calc(50%-1px)_0_0)]" />
    </div>
  );
}
