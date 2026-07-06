import { NextRequest, NextResponse } from "next/server";

const API_COURIER = (process.env.NEXT_PUBLIC_API_GATEWAY || "http://localhost:8083").replace(/\/$/, "") + "/courier";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ liquidationId: string }> },
) {
  console.log("[POST] Handler iniciado");

  const { liquidationId } = await context.params;
  console.log("[POST] liquidationId:", liquidationId);

  const headers: Record<string, string> = {};
  const authHeader = request.headers.get("Authorization");

  console.log("[POST] Authorization header:", authHeader);

  if (authHeader) headers["Authorization"] = authHeader;

  const url = `${API_COURIER}/guide-liquidations/${liquidationId}/transactions/payments`;
  console.log("[POST] URL:", url);

  try {
    const formData = await request.formData();

    // 👇 OJO: formData no se puede loggear directo → hay que iterar
    console.log("[POST] FormData entries:");
    for (const [key, value] of formData.entries()) {
      console.log(`   ${key}:`, value);
    }

    console.log("[POST] Enviando request al backend...");

    const res = await fetch(url, {
      method: "POST",
      headers,
      body: formData,
      cache: "no-store",
    });

    console.log("[POST] Response status:", res.status);

    if (!res.ok) {
      const text = await res.text();
      console.error("[POST] Error response:", text);

      return NextResponse.json({ error: text }, { status: res.status });
    }

    const data: unknown = await res.json();
    console.log("[POST] Response OK:", data);

    return NextResponse.json(data, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";

    console.error("[POST] Exception:", message);

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
