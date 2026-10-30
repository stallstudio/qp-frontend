import { NextResponse } from "next/server";
import { getClientIp } from "@/lib/ip-rules";
import {
  ACCESS_COOKIE,
  accessCookieValue,
  getAccessCode,
  isAccessCode,
} from "@/lib/access-gate";

// 4 chiffres, c'est 10 000 codes : sans plafond, un script les essaie tous en
// quelques minutes. Au-delà de MAX_FAILURES essais ratés dans la fenêtre, l'IP
// est refusée sans que son code soit même comparé.
//
// Compteur en mémoire : il repart de zéro à chaque déploiement, ce qui suffit
// pour un verrou de ce genre.
const MAX_FAILURES = 10;
const FAILURE_WINDOW_MS = 15 * 60_000;
const failures = new Map<string, { count: number; resetAt: number }>();

function failureCount(ip: string, now: number): number {
  const entry = failures.get(ip);
  if (!entry) return 0;
  if (entry.resetAt <= now) {
    failures.delete(ip);
    return 0;
  }
  return entry.count;
}

function recordFailure(ip: string, now: number) {
  const entry = failures.get(ip);
  if (entry && entry.resetAt > now) {
    entry.count += 1;
    return;
  }
  failures.set(ip, { count: 1, resetAt: now + FAILURE_WINDOW_MS });

  // Un robot qui change d'IP à chaque essai laisserait autant d'entrées : on
  // fait le ménage des fenêtres expirées passé un certain volume.
  if (failures.size > 10_000) {
    for (const [key, value] of failures) {
      if (value.resetAt <= now) failures.delete(key);
    }
  }
}

/**
 * Vérifie le code saisi sur l'écran d'accès et, s'il est bon, pose le cookie
 * qui ouvre le site (voir `lib/access-gate.ts`).
 *
 * Hors du `matcher` de `middleware.ts`, comme toutes les routes `/api/` : elle
 * reste donc joignable quand le site est verrouillé.
 */
export async function POST(request: Request) {
  const code = getAccessCode();
  if (!code) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const ip = getClientIp(request);
  const now = Date.now();
  if (failureCount(ip, now) >= MAX_FAILURES) {
    return NextResponse.json({ error: "Too many attempts" }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const attempt = typeof body?.code === "string" ? body.code : "";
  if (!isAccessCode(attempt)) {
    recordFailure(ip, now);
    return NextResponse.json({ error: "Wrong code" }, { status: 401 });
  }

  failures.delete(ip);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(ACCESS_COOKIE, accessCookieValue(code), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return response;
}
