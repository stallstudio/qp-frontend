import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const ipAddress =
    request.headers.get("x-forwarded-for")?.split(",")[0] ??
    request.headers.get("x-real-ip") ??
    "unknown";
  const userAgent = request.headers.get("user-agent");

  try {
    const body = await request.json();
    const { parkIdentifier, category, subcategory, details } = body;

    if (!parkIdentifier || !category || !subcategory || !details?.trim()) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    const prisma = getPrisma();

    await prisma.report.create({
      data: {
        parkIdentifier,
        category,
        subcategory,
        details: details.trim(),
        ipAddress,
        userAgent,
      },
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
