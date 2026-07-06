import { NextRequest, NextResponse } from "next/server";

const API_COURIER = (process.env.NEXT_PUBLIC_API_GATEWAY || "http://localhost:8083").replace(/\/$/, "") + "/courier";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ liquidationId: string }> },
) {
  const { liquidationId } = await context.params;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  const authHeader = request.headers.get("Authorization");
  if (authHeader) {
    headers["Authorization"] = authHeader;
  }

  const url = `${API_COURIER}/guide-liquidations/${liquidationId}/details`;

  try {
    const res = await fetch(url, {
      headers,
      cache: "no-store",
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ error: text }, { status: res.status });
    }

    const data: unknown = await res.json();

    if (Array.isArray(data)) {
      return NextResponse.json({
        pedidos: data,
        pagos: [],
        saldoPendiente: null,
      });
    }

    return NextResponse.json(data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ liquidationId: string }> },
) {
  const { liquidationId } = await context.params;

  const { searchParams } = new URL(request.url);
  const storeId = searchParams.get("storeId");

  if (!storeId) {
    return NextResponse.json({ error: "storeId es requerido" }, { status: 400 });
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  const authHeader = request.headers.get("Authorization");
  if (authHeader) {
    headers["Authorization"] = authHeader;
  }

  const url = `${API_COURIER}/guide-liquidations/store/${storeId}/${liquidationId}`;

  try {
    const body = await request.text();

    const res = await fetch(url, {
      method: "PATCH",
      headers,
      body,
      cache: "no-store",
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ error: text }, { status: res.status });
    }

    const data: unknown = await res.json();
    return NextResponse.json(data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
