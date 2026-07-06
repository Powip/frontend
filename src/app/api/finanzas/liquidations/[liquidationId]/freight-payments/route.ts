import { NextRequest, NextResponse } from "next/server";

const API_COURIER = (process.env.NEXT_PUBLIC_API_GATEWAY || "http://localhost:8083").replace(/\/$/, "") + "/courier";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ liquidationId: string }> },
) {
  const { liquidationId } = await context.params;

  const headers: Record<string, string> = {};
  const authHeader = request.headers.get("Authorization");
  if (authHeader) headers["Authorization"] = authHeader;

  const url = `${API_COURIER}/guide-liquidations/${liquidationId}/freight-payments`;

  try {
    const formData = await request.formData();

    const res = await fetch(url, {
      method: "POST",
      headers,
      body: formData,
      cache: "no-store",
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ error: text }, { status: res.status });
    }

    const data: unknown = await res.json();
    return NextResponse.json(data, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
