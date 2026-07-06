import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const base = (process.env.NEXT_PUBLIC_API_GATEWAY || "http://localhost:8083").replace(/\/$/, "") + "/subscription";

  console.log("[CARD STATUS] Base URL:", base);

  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");
  const userId = req.headers.get("x-user-id");

  console.log("[CARD STATUS] Params:", { userId, token });

  if (!userId || !token) {
    console.warn("[CARD STATUS] Missing params");

    return NextResponse.json(
      { error: "userId y token son requeridos" },
      { status: 400 },
    );
  }

  try {
    const url = `${base}/customers/register/card/status?token=${encodeURIComponent(token)}`;

    console.log("[CARD STATUS] Fetching:", url);
    console.log("[CARD STATUS] Headers:", { "x-user-id": userId });

    const res = await fetch(url, {
      method: "GET",
      headers: {
        "x-user-id": userId,
      },
      cache: "no-store",
    });

    console.log("[CARD STATUS] Response status:", res.status);

    if (!res.ok) {
      const errorText = await res.text();
      console.error("[CARD STATUS] Error response body:", errorText);

      return NextResponse.json(
        { error: errorText || "Error al consultar estado de tarjeta" },
        { status: res.status },
      );
    }

    const data: unknown = await res.json();
    console.log("[CARD STATUS] Response data:", data);

    return NextResponse.json(data);
  } catch (error) {
    console.error("[CARD STATUS] Internal error:", error);

    return NextResponse.json(
      { error: "Error interno al consultar estado de tarjeta" },
      { status: 500 },
    );
  }
}
