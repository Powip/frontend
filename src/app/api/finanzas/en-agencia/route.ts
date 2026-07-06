import { NextRequest, NextResponse } from "next/server";

const API_COURIER = (process.env.NEXT_PUBLIC_API_GATEWAY || "http://localhost:8083").replace(/\/$/, "") + "/courier";

export async function GET(request: NextRequest) {
  console.log("[en-agencia] Request URL:", request.url);

  const { searchParams } = new URL(request.url);
  const storeId = searchParams.get("storeId");

  console.log("[en-agencia] storeId:", storeId);

  if (!storeId) {
    console.warn("[en-agencia] Missing storeId");
    return NextResponse.json({ error: "storeId is required" }, { status: 400 });
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const authHeader = request.headers.get("Authorization");

  console.log("[en-agencia] Authorization header exists:", !!authHeader);

  if (authHeader) headers["Authorization"] = authHeader;

  const url = `${API_COURIER}/shipping-guides/store/${storeId}/en-agencia-recojo`;
  console.log("[en-agencia] Fetch URL:", url);

  try {
    const res = await fetch(url, {
      headers,
      cache: "no-store",
    });

    console.log("[en-agencia] Response status:", res.status);

    if (!res.ok) {
      const text = await res.text();
      console.error("[en-agencia] Error response:", text);
      return NextResponse.json({ error: text }, { status: res.status });
    }

    const data = await res.json();

    const response = {
      amount: Number(data.amount ?? 0),
      count: Number(data.count ?? 0),
      carrier: data.carrier ?? null,
    };

    console.log("[en-agencia] Final response:", response);

    return NextResponse.json(response);
  } catch (err: any) {
    console.error("[api/finanzas/en-agencia] Exception:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
