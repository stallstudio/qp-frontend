import { flushSync } from "react-dom";

// Applique un changement de thème avec la révélation circulaire (View Transition
// API), centrée sur un point — en général le bouton cliqué. Reprend l'effet du
// bouton du footer (`AnimatedThemeToggler`) pour l'uniformiser dans toute l'app.
// Repli immédiat (sans animation) si l'API n'est pas disponible ou si
// l'utilisateur a demandé à réduire les animations.
export function startThemeTransition(
  apply: () => void,
  origin?: { x: number; y: number },
  duration = 400,
) {
  const reduce =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (
    typeof document === "undefined" ||
    typeof document.startViewTransition !== "function" ||
    reduce
  ) {
    apply();
    return;
  }

  const vw = window.visualViewport?.width ?? window.innerWidth;
  const vh = window.visualViewport?.height ?? window.innerHeight;
  const x = origin?.x ?? vw / 2;
  const y = origin?.y ?? vh / 2;
  const maxRadius = Math.hypot(Math.max(x, vw - x), Math.max(y, vh - y));

  const transition = document.startViewTransition(() => flushSync(apply));

  const ready = transition?.ready;
  if (ready && typeof ready.then === "function") {
    ready
      .then(() => {
        document.documentElement.animate(
          {
            clipPath: [
              `circle(0px at ${x}px ${y}px)`,
              `circle(${maxRadius}px at ${x}px ${y}px)`,
            ],
          },
          {
            duration,
            easing: "ease-in-out",
            pseudoElement: "::view-transition-new(root)",
          },
        );
      })
      .catch(() => {});
  }
}

// Le thème demandé aboutit-il au mode sombre ? Sert à appliquer la classe `dark`
// de façon SYNCHRONE dans la transition (next-themes l'applique de façon
// asynchrone, trop tard pour que la View Transition capture le nouvel état).
export function resolvesToDark(theme: "light" | "dark" | "system") {
  if (theme === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  }
  return theme === "dark";
}
