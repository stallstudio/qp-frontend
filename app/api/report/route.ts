import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { getCategoryLabel, getSubcategoryLabel } from "@/lib/report-config";

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
        name: "Email",
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

export async function POST(request: Request) {
  const ipAddress =
    request.headers.get("x-forwarded-for")?.split(",")[0] ??
    request.headers.get("x-real-ip") ??
    "unknown";
  const userAgent = request.headers.get("user-agent");

  try {
    const body = await request.json();
    const { parkIdentifier, category, subcategory, details, email, locale } =
      body;

    if (
      !parkIdentifier ||
      !category ||
      !subcategory ||
      !details?.trim() ||
      !email?.trim()
    ) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    const prisma = getPrisma();

    const trimmedDetails = details.trim();
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedLocale = locale || "en";

    await prisma.report.create({
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

    await sendReportDiscordNotification({
      parkIdentifier,
      category,
      subcategory,
      details: trimmedDetails,
      email: normalizedEmail,
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
