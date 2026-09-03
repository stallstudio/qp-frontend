import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getPrisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/ip-rules";
import { getCategoryLabel, getSubcategoryLabel } from "@/lib/report-config";
import { captureRawSnapshotForReport } from "@/lib/raw-capture";

interface DiscordEmbed {
  title: string;
  description?: string;
  color: number;
  fields?: Array<{
    name: string;
    value: string;
    inline?: boolean;
  }>;
  timestamp?: string;
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 1) + "…";
}

async function sendReportDiscordNotification(params: {
  parkIdentifier: string;
  category: string;
  subcategory: string;
  details: string;
  email: string;
  // Vrai si l'e-mail provient du compte connecté (et non d'une saisie libre) :
  // information utile au support pour savoir à qui il répond réellement.
  fromAccount: boolean;
  locale: string;
  ipAddress: string;
  userAgent: string | null;
}): Promise<void> {
  const url = process.env.DISCORD_REPORT_WEBHOOK_URL;
  if (!url) {
    return;
  }

  const {
    parkIdentifier,
    category,
    subcategory,
    details,
    email,
    fromAccount,
    locale,
    ipAddress,
    userAgent,
  } = params;

  const embed: DiscordEmbed = {
    title: "📝 Nouveau signalement reçu",
    color: 0xff914d,
    fields: [
      {
        name: "Parc",
        value: `\`${parkIdentifier}\``,
        inline: false,
      },

      {
        name: "Catégorie",
        value: getCategoryLabel(category, "fr"),
        inline: false,
      },
      {
        name: "Sous-catégorie",
        value: getSubcategoryLabel(category, subcategory, "fr"),
        inline: false,
      },
      {
        name: "Détails",
        value: truncate(details, 1500),
        inline: false,
      },
      {
        name: fromAccount ? "Email (compte)" : "Email",
        value: `\`${email}\``,
        inline: true,
      },
      {
        name: "Locale",
        value: `\`${locale}\``,
        inline: true,
      },
    ],
    timestamp: new Date().toISOString(),
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ embeds: [embed] }),
    });

    if (!response.ok) {
      throw new Error(
        `Discord webhook failed: ${response.status} ${response.statusText}`,
      );
    }
  } catch (error) {
    console.error("Failed to send Discord report notification", error);
  }
}

// Plafond par IP : un signalement légitime est un acte rare et réfléchi. Cinq
// par heure laisse largement la place à quelqu'un qui remonte plusieurs
// anomalies d'affilée, tout en rendant inutile une boucle de spam (qui
// remplirait la table `reports` ET noierait le webhook Discord).
const REPORT_LIMIT = 5;
const REPORT_WINDOW_MS = 60 * 60_000;

export async function POST(request: Request) {
  // ⚠️ `getClientIp` et non les en-têtes lus à la main. Deux raisons : depuis
  // la bascule Cloudflare du 2026-08-26 ces en-têtes portent le datacenter et
  // non le visiteur — le plafond de cinq signalements par heure s'appliquait
  // donc à un point de sortie entier, punissant des inconnus pour le spam d'un
  // autre — et la valeur de repli doit être la MÊME chaîne que celle
  // qu'écartent les règles d'accès (`UNKNOWN_IP`).
  const ipAddress = getClientIp(request);
  const userAgent = request.headers.get("user-agent");

  try {
    const body = await request.json();
    const {
      parkIdentifier,
      category,
      subcategory,
      details,
      email,
      locale,
      website,
    } = body;

    // Honeypot : `website` est un champ invisible que seul un robot remplit. On
    // répond 200 (et non 400) pour ne pas lui apprendre qu'il a été repéré.
    if (typeof website === "string" && website.trim() !== "") {
      return NextResponse.json({ success: true });
    }

    const limit = rateLimit(
      `report:${ipAddress}`,
      REPORT_LIMIT,
      REPORT_WINDOW_MS,
    );
    if (!limit.allowed) {
      return NextResponse.json(
        { error: "Too many requests" },
        {
          status: 429,
          headers: { "Retry-After": String(limit.retryAfter) },
        },
      );
    }

    // Utilisateur connecté : l'e-mail vient de la SESSION, jamais du corps de la
    // requête (le client ne l'envoie plus, et on ne lui ferait pas confiance).
    const session = await auth();
    const accountEmail = session?.user?.email?.trim() || null;
    const effectiveEmail =
      accountEmail ?? (typeof email === "string" ? email.trim() : "");

    if (
      !parkIdentifier ||
      !category ||
      !subcategory ||
      !details?.trim() ||
      !effectiveEmail
    ) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    const prisma = getPrisma();

    const trimmedDetails = details.trim();
    const normalizedEmail = effectiveEmail.toLowerCase();
    const normalizedLocale = locale || "en";

    const report = await prisma.report.create({
      data: {
        parkIdentifier,
        category,
        subcategory,
        details: trimmedDetails,
        email: normalizedEmail,
        locale: normalizedLocale,
        ipAddress,
        userAgent,
      },
    });

    // Fige la dernière réponse connue de chaque API du parc, avant que le
    // passage suivant ne l'écrase. C'est ce qui permettra, en admin, de
    // comparer ce que la source publiait à ce que le visiteur a vu — voir
    // `lib/raw-capture.ts`.
    await captureRawSnapshotForReport(prisma, report.id, parkIdentifier);

    await sendReportDiscordNotification({
      parkIdentifier,
      category,
      subcategory,
      details: trimmedDetails,
      email: normalizedEmail,
      fromAccount: accountEmail !== null,
      locale: normalizedLocale,
      ipAddress,
      userAgent,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error creating report", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
