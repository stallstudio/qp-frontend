import { NextRequest, NextResponse } from "next/server";
import axios from "axios";
import https from "https";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ parkId: string }> }
) {
  try {
    const { parkId } = await params;
    const apiKey = process.env.WORKER_API_KEY;
    const apiUrl = process.env.WORKER_API_URL;

    console.log("🔍 API Route Debug:", {
      parkId,
      hasApiKey: !!apiKey,
      apiUrl,
    });

    if (!apiKey) {
      console.error("❌ WORKER_API_KEY is not configured");
      return NextResponse.json(
        { error: "API key not configured" },
        { status: 500 }
      );
    }

    if (!apiUrl) {
      console.error("❌ WORKER_API_URL is not configured");
      return NextResponse.json(
        { error: "API URL not configured" },
        { status: 500 }
      );
    }

    const httpsAgent =
      process.env.NODE_ENV === "development"
        ? new https.Agent({ rejectUnauthorized: false })
        : undefined;

    const response = await axios.get(`${apiUrl}/waittimes/${parkId}`, {
      headers: {
        "x-api-key": apiKey,
        "Content-Type": "application/json",
      },
      httpsAgent,
    });

    console.log("✅ Data received successfully, status:", response.status);

    return NextResponse.json(response.data);
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error("❌ Axios Error:", {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message,
      });

      return NextResponse.json(
        {
          error: "Failed to fetch park data",
          details: error.response?.data || error.message,
          status: error.response?.status || 500,
        },
        { status: error.response?.status || 500 }
      );
    }

    console.error("❌ Error fetching park data:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
