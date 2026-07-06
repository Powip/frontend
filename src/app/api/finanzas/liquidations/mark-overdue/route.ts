import { NextRequest, NextResponse } from "next/server";

const API_COURIER = (process.env.NEXT_PUBLIC_API_GATEWAY || "http://localhost:8083").replace(/\/$/, "") + "/courier";

export async function PATCH(request: NextRequest) {
  console.log("[PATCH] Handler iniciado");

  const { searchParams } = new URL(request.url);
  console.log("[PATCH] URL:", request.url);

  const storeId = searchParams.get("storeId");
  console.log("[PATCH] storeId:", storeId);

  if (!storeId) {
    console.log("[PATCH] ❌ storeId faltante");
    return NextResponse.json({ error: "storeId is required" }, { status: 400 });
  }

  console.log("[PATCH] API_COURIER:", API_COURIER);

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  const authHeader = request.headers.get("Authorization");
  console.log("[PATCH] Authorization header:", authHeader);

  if (authHeader) {
    headers["Authorization"] = authHeader;
  }

  console.log("[PATCH] Headers finales:", headers);

  try {
    const body = await request.text();
    console.log("[PATCH] Body recibido:", body);

    const url = `${API_COURIER}/guide-liquidations/store/${storeId}/mark-overdue`;
    console.log("[PATCH] Fetch URL:", url);

    const res = await fetch(url, {
      method: "PATCH",
      headers,
      body: body || undefined,
      cache: "no-store",
    });

    console.log("[PATCH] Response status:", res.status);
    console.log("[PATCH] Response ok:", res.ok);

    const responseText = await res.text();
    console.log("[PATCH] Response body raw:", responseText);

    if (!res.ok) {
      return NextResponse.json({ error: responseText }, { status: res.status });
    }

    let data;
    try {
      data = JSON.parse(responseText);
    } catch {
      data = {};
    }

    console.log("[PATCH] Response parsed:", data);

    return NextResponse.json(data);
  } catch (err: any) {
    console.error("[api/finanzas/liquidations/mark-overdue] Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
