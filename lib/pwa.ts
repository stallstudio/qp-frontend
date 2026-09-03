// Détection PWA + capture de l'invite d'installation, au niveau module afin
// d'attacher les listeners le plus tôt possible : `beforeinstallprompt` peut se
// déclencher avant le montage de tout composant React. Le hook `usePwaInstall`
// s'abonne à ce petit store.

export type PwaPlatform = "ios" | "android" | "desktop";

// L'événement n'est pas typé dans la lib DOM standard.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) listener();
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    // On empêche la mini-infobar native pour proposer notre propre bouton.
    event.preventDefault();
    deferredPrompt = event as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    installed = true;
    deferredPrompt = null;
    notify();
  });
}

export function subscribePwa(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// true dès qu'une invite d'installation native est disponible (Chrome/Edge).
export function canInstall(): boolean {
  return deferredPrompt !== null;
}

export type PromptInstall = () => Promise<
  "accepted" | "dismissed" | "unavailable"
>;

// Déclenche l'invite native. L'événement n'étant utilisable qu'une fois, on le
// consomme puis on notifie.
export async function promptInstall(): Promise<
  "accepted" | "dismissed" | "unavailable"
> {
  if (!deferredPrompt) return "unavailable";
  await deferredPrompt.prompt();
  const choice = await deferredPrompt.userChoice;
  deferredPrompt = null;
  notify();
  return choice.outcome;
}

// L'app tourne-t-elle en mode « installée » (standalone) ?
export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const displayMode = window.matchMedia?.(
    "(display-mode: standalone)",
  ).matches;
  // iOS Safari expose `navigator.standalone` (hors display-mode).
  const iosStandalone =
    (window.navigator as unknown as { standalone?: boolean }).standalone ===
    true;
  return Boolean(displayMode || iosStandalone || installed);
}

export function detectPlatform(): PwaPlatform {
  if (typeof navigator === "undefined") return "desktop";
  const ua = navigator.userAgent || "";
  if (/android/i.test(ua)) return "android";
  // iPadOS 13+ se déclare comme un Mac : on le repère au support tactile.
  const isIOS =
    /iphone|ipad|ipod/i.test(ua) ||
    (/macintosh/i.test(ua) &&
      typeof document !== "undefined" &&
      "ontouchend" in document);
  if (isIOS) return "ios";
  return "desktop";
}
