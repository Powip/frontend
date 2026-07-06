import { NextRequest, NextResponse } from "next/server";

const API_COURIER = (process.env.NEXT_PUBLIC_API_GATEWAY || "http://localhost:8083").replace(/\/$/, "") + "/courier";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const storeId = searchParams.get("storeId");

  if (!storeId) {
    return NextResponse.json({ error: "storeId is required" }, { status: 400 });
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const authHeader = request.headers.get("Authorization");
  if (authHeader) headers["Authorization"] = authHeader;

  try {
    const res = await fetch(
      `${API_COURIER}/shipping-guides/store/${storeId}/reassigned-active`,
      { headers, cache: "no-store" },
    );

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ error: text }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json({
      count: Number(data.count ?? 0),
      subtitle: data.subtitle ?? "",
    });
  } catch (err: any) {
    console.error("[api/finanzas/reassigned]", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
