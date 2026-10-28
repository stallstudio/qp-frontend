import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getClientIp } from "@/lib/ip-rules";
import { dispatchFetch, relay } from "@/lib/dispatch";

/**
 * Signalement d'un visiteur, enregistré par l'API Dispatch (`/v1/reports`) :
 * validation, plafond de cinq par heure et par IP, photo des réponses brutes
 * du parc et notification Discord compris.
 *
 * Le corps du visiteur est relayé TEL QUEL. Queue Park n'y ajoute que ce que
 * lui seul connaît : l'IP réelle (`getClientIp`, la même chaîne de repli que
 * celle qu'écartent les règles d'accès), le user agent, et l'e-mail du compte
 * connecté — qui prime sur celui du formulaire, auquel on ne ferait pas
 * confiance.
 */
export async function POST(request: Request) {
  try {
    const session = await auth();
    return relay(
      await dispatchFetch("/v1/reports", {
        raw: await request.text(),
        viewer: {
          ip: getClientIp(request),
          userAgent: request.headers.get("user-agent"),
          email: session?.user?.email?.trim() || null,
        },
      }),
    );
  } catch (error) {
    console.error("Error creating report", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
