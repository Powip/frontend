import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const base = (process.env.NEXT_PUBLIC_API_GATEWAY || "http://localhost:8083").replace(/\/$/, "") + "/subscription";

  console.log("[GET INVOICES] Base URL:", base);

  const { searchParams } = new URL(req.url);
  const subscriptionId = searchParams.get("subscriptionId");

  console.log("[GET INVOICES] Query params:", { subscriptionId });

  if (!subscriptionId) {
    console.warn("[GET INVOICES] Missing subscriptionId");

    return NextResponse.json(
      { error: "subscriptionId es requerido" },
      { status: 400 },
    );
  }

  const userId = req.headers.get("x-user-id") ?? "";

  try {
    const url = `${base}/subscriptions/${subscriptionId}/invoices`;
    console.log("[GET INVOICES] Fetching:", url);

    const res = await fetch(url, {
      headers: { "x-user-id": userId },
      cache: "no-store",
    });

    console.log("[GET INVOICES] Response status:", res.status);

    if (!res.ok) {
      const errorText = await res.text();
      console.error("[GET INVOICES] Error response body:", errorText);

      return NextResponse.json(
        { error: errorText || "Error al obtener facturas" },
        { status: res.status },
      );
    }

    const data: unknown = await res.json();
    console.log("[GET INVOICES] Response data:", data);

    return NextResponse.json(data);
  } catch (error) {
    console.error("[GET INVOICES] Internal error:", error);

    return NextResponse.json(
      { error: "Error interno al obtener facturas" },
      { status: 500 },
    );
  }
}
