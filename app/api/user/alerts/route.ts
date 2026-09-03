import { NextRequest, NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth-helpers";
import { getUserPrisma } from "@/lib/user-prisma";
import { getPrisma } from "@/lib/prisma";
import { toAlertDTO } from "@/lib/user-account";
import {
  reopenAllowedForWindow,
  REOPEN_CREATE_CLOSING_MARGIN_MS,
} from "@/lib/park-closing";
import { loadParkHourPeriods, rideOpenWindow } from "@/lib/park-closing-db";
import type { AlertType } from "@/types/user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MIN_THRESHOLD = 1;
const MAX_THRESHOLD = 600;

// Statuts pour lesquels une alerte de RÉOUVERTURE a un sens : l'attraction ne
// publie pas de temps d'attente exploitable, la seule nouvelle utile est sa
// remise en service. Le complémentaire (`open`) est le domaine des alertes de
// seuil. Voir l'enum AlertType du schéma utilisateurs.
const REOPEN_ELIGIBLE_STATUSES = new Set(["down", "maintenance", "closed"]);

// GET : toutes les alertes de l'utilisateur (actives et désactivées),
// les plus récentes d'abord.
export async function GET() {
  const { userId, response } = await requireUserId();
  if (!userId) return response || NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await getUserPrisma().alert.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(rows.map(toAlertDTO));
}

// POST : crée (ou met à jour) une alerte pour une attraction.
// Appelé UNIQUEMENT depuis le popup d'une attraction — jamais depuis le profil.
// Une seule alerte par attraction et par utilisateur (@@unique userId+rideId) :
// re-soumettre réactive et met à jour l'alerte, y compris en changeant sa nature
// (une alerte de réouverture consommée devient une alerte de seuil dès que
// l'utilisateur en pose une sur l'attraction rouverte).
//
// `type` vaut "threshold" par défaut : les clients antérieurs à l'ajout des
// alertes de réouverture continuent de fonctionner à l'identique.
export async function POST(request: NextRequest) {
  const { userId, response } = await requireUserId();
  if (!userId) return response || NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (!body) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const rideId = Number(body.rideId);
  const parkIdentifier = body.parkIdentifier;
  const rideName = body.rideName;
  const parkName = body.parkName;
  const type: AlertType = body.type === "reopen" ? "reopen" : "threshold";

  if (
    !Number.isInteger(rideId) ||
    typeof parkIdentifier !== "string" ||
    typeof rideName !== "string" ||
    typeof parkName !== "string"
  ) {
    return NextResponse.json(
      { error: "Invalid alert payload" },
      { status: 400 },
    );
  }

  // Le seuil n'est requis (et n'est accepté) que pour une alerte de seuil : une
  // alerte de réouverture n'en a pas, et en stocker un serait un mensonge que
  // l'affichage finirait par répéter.
  let threshold: number | null = null;
  if (type === "threshold") {
    threshold = Number(body.threshold);
    if (
      !Number.isInteger(threshold) ||
      threshold < MIN_THRESHOLD ||
      threshold > MAX_THRESHOLD
    ) {
      return NextResponse.json({ error: "Invalid threshold" }, { status: 400 });
    }
  }

  // Cohérence avec l'ÉTAT RÉEL de l'attraction, vérifiée ici et pas seulement
  // dans l'UI. Le formulaire choisit déjà la bonne nature d'alerte d'après le
  // statut affiché, mais ce statut a pu changer entre l'ouverture du popup et
  // l'envoi : une attraction réparée entre-temps donnerait une alerte de
  // réouverture qui ne se déclencherait jamais (le moteur exige une transition
  // vers `open`, or elle y est déjà). On refuse plutôt que d'enregistrer une
  // alerte silencieusement morte.
  const current = await getPrisma().waitTime.findFirst({
    where: { poiId: rideId, endTime: null, type: "standby" },
    select: { status: true, parkId: true },
  });
  const status = current ? String(current.status) : null;

  if (type === "reopen" && (status === null || !REOPEN_ELIGIBLE_STATUSES.has(status))) {
    return NextResponse.json(
      { error: "Ride is not currently stopped", status },
      { status: 409 },
    );
  }

  // Trop près de la fermeture : ce qui s'arrête maintenant s'arrête pour la
  // nuit, pas pour une panne. Voir `lib/park-closing.ts` — la même règle borne le
  // réarmement automatique côté moteur, avec une marge plus large ET une vue
  // plus étroite des horaires (`scope`).
  //
  // ⚠️ Le `scope: "create"` compte les SESSIONS D'ÉVÉNEMENT comme une ouverture,
  // pour tout le parc : pendant Halloween Horror Nights, une alerte peut être
  // posée sur n'importe quelle attraction, y compris une attraction de jour qui
  // rouvrirait pour la soirée. Le pire qui puisse en sortir est une alerte
  // muette, effacée en fin de journée.
  if (type === "reopen" && current) {
    const now = new Date();
    const periodsByPark = await loadParkHourPeriods([current.parkId], now);
    if (
      !reopenAllowedForWindow(
        rideOpenWindow(periodsByPark.get(current.parkId), now, {
          scope: "create",
        }),
        now,
        REOPEN_CREATE_CLOSING_MARGIN_MS,
      )
    ) {
      return NextResponse.json(
        { error: "Park is closing", status },
        { status: 409 },
      );
    }
  }
  if (type === "threshold" && status !== null && status !== "open") {
    return NextResponse.json(
      { error: "Ride is not currently open", status },
      { status: 409 },
    );
  }

  // (Ré)activation : on réarme le moteur et on (re)cale le jour de validité sur
  // aujourd'hui (l'alerte ne vaut que pour la journée en cours).
  const now = new Date();
  const alert = await getUserPrisma().alert.upsert({
    where: { userId_rideId: { userId, rideId } },
    update: {
      type,
      threshold,
      active: true,
      armed: true,
      activeDate: now,
      // Remis à zéro : c'est une nouvelle alerte du point de vue du moteur. Le
      // laisser tel quel rouvrirait la fenêtre de réarmement automatique d'une
      // réouverture déjà notifiée plus tôt dans la journée.
      lastAlertedAt: null,
      rideName,
      parkName,
      parkIdentifier,
    },
    create: {
      userId,
      rideId,
      parkIdentifier,
      rideName,
      parkName,
      type,
      threshold,
      active: true,
      activeDate: now,
    },
  });

  return NextResponse.json(toAlertDTO(alert), { status: 201 });
}
