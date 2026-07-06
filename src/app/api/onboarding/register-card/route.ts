import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const base = (process.env.NEXT_PUBLIC_API_GATEWAY || "http://localhost:8083").replace(/\/$/, "") + "/subscription";

  console.log("[REGISTER CARD] Base URL:", base);

  try {
    // 🔥 NO usar req.json()
    const userId = req.headers.get("x-user-id") || "";

    console.log("[REGISTER CARD] userId:", userId);

    if (!userId) {
      console.warn("[REGISTER CARD] Missing x-user-id");

      return NextResponse.json(
        { error: "Missing x-user-id header" },
        { status: 400 },
      );
    }

    const url = `${base}/customers/register/card`;

    console.log("[REGISTER CARD] Fetching:", url);

    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer token: ${userId}`,
      },
    });

    console.log("[REGISTER CARD] Response status:", res.status);

    if (!res.ok) {
      const errorText = await res.text();
      console.error("[REGISTER CARD] Error response body:", errorText);

      return NextResponse.json(
        { error: errorText || "Error al iniciar registro de tarjeta" },
        { status: res.status },
      );
    }

    const data = await res.json();
    console.log("[REGISTER CARD] Response data:", data);

    return NextResponse.json(data);
  } catch (error) {
    console.error("[REGISTER CARD] Internal error:", error);

    return NextResponse.json(
      { error: "Error interno al registrar tarjeta" },
      { status: 500 },
    );
  }
}
