import { NextRequest, NextResponse } from "next/server";

const API_COURIER = (process.env.NEXT_PUBLIC_API_GATEWAY || "http://localhost:8083").replace(/\/$/, "") + "/courier";

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
      `${API_COURIER}/guide-liquidations/store/${storeId}/top-dashboard-metrics`,
      { headers, cache: "no-store" }
    );

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ error: text }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json({
      pendingCod: {
        amount: Number(data.pendingCod?.amount ?? 0),
        count: Number(data.pendingCod?.count ?? 0),
      },
      overdue: {
        amount: Number(data.overdue?.amount ?? 0),
        count: Number(data.overdue?.count ?? 0),
        courier: data.overdue?.courier ?? null,
      },
      liquidatedThisMonth: {
        amount: Number(data.liquidatedThisMonth?.amount ?? 0),
        count: Number(data.liquidatedThisMonth?.count ?? 0),
        month: data.liquidatedThisMonth?.month ?? "",
        year: Number(data.liquidatedThisMonth?.year ?? 0),
      },
    });
  } catch (err: any) {
    console.error("[api/finanzas/top-metrics]", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
