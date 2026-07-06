import { NextRequest, NextResponse } from "next/server";

interface SubscriptionRequestBody {
  planId: string;
  planAdditionalList: string[];
  trial_period_days?: number;
  periods_number?: number;
}

export async function POST(req: NextRequest) {
  const base = (process.env.NEXT_PUBLIC_API_GATEWAY || "http://localhost:8083").replace(/\/$/, "") + "/subscription";

  console.log("[CREATE SUBSCRIPTION] Base URL:", base);

  try {
    const body = (await req.json()) as SubscriptionRequestBody;
    console.log("[CREATE SUBSCRIPTION] Request body:", body);

    const { planId, planAdditionalList, trial_period_days, periods_number } =
      body;

    console.log("[CREATE SUBSCRIPTION] Parsed body:", {
      planId,
      planAdditionalList,
      trial_period_days,
      periods_number,
    });

    if (!planId) {
      console.warn("[CREATE SUBSCRIPTION] Missing planId");
    }

    const userId = req.headers.get("x-user-id") ?? "";

    const url = `${base}/subscriptions`;
    console.log("[CREATE SUBSCRIPTION] Fetching:", url);
    console.log("[CREATE SUBSCRIPTION] Headers:", {
      "Content-Type": "application/json",
      "x-user-id": userId,
    });

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-user-id": userId,
      },
      body: JSON.stringify(body),
    });

    console.log("[CREATE SUBSCRIPTION] Response status:", res.status);

    if (!res.ok) {
      const errorText = await res.text();
      console.error("[CREATE SUBSCRIPTION] Error response body:", errorText);

      return NextResponse.json(
        { error: errorText || "Error al crear suscripción" },
        { status: res.status },
      );
    }

    const data: unknown = await res.json();
    console.log("[CREATE SUBSCRIPTION] Response data:", data);

    return NextResponse.json(data);
  } catch (error) {
    console.error("[CREATE SUBSCRIPTION] Internal error:", error);

    return NextResponse.json(
      { error: "Error interno al crear suscripción" },
      { status: 500 },
    );
  }
}
