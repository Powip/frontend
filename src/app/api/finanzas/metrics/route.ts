import { NextRequest, NextResponse } from "next/server";

const API_COURIER = (process.env.NEXT_PUBLIC_API_GATEWAY || "http://localhost:8083").replace(/\/$/, "") + "/courier";

// TypeORM returns decimals as strings — normalize everything
function toNum(val: unknown): number {
  if (val === null || val === undefined || val === "") return 0;
  const n = Number(val);
  return isNaN(n) ? 0 : n;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const storeId = searchParams.get("storeId");

  if (!storeId) {
    return NextResponse.json({ error: "storeId is required" }, { status: 400 });
  }

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const authHeader = request.headers.get("Authorization");
  if (authHeader) headers["Authorization"] = authHeader;

  try {
    const res = await fetch(
      `${API_COURIER}/guide-liquidations/store/${storeId}/dashboard/metrics`,
      { headers, cache: "no-store" }
    );

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ error: text }, { status: res.status });
    }

    const raw = await res.json();

    // Normalize every field — API returns strings from TypeORM decimals
    const normalized: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(raw)) {
      normalized[key] = typeof val === "string" || typeof val === "number"
        ? toNum(val)
        : val;
    }

    return NextResponse.json(normalized);
  } catch (err: any) {
    console.error("[api/finanzas/metrics]", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
