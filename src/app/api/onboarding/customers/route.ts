import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const base = (process.env.NEXT_PUBLIC_API_GATEWAY || "http://localhost:8083").replace(/\/$/, "") + "/subscription";

  console.log("[CREATE CUSTOMER] Base URL:", base);

  try {
    // 🔹 Body correcto (solo name y email)
    const body = (await req.json()) as {
      name?: string;
      email?: string;
    };

    console.log("[CREATE CUSTOMER] Request body:", body);

    // 🔹 Header correcto
    const userId = req.headers.get("x-user-id") || "";

    console.log("[CREATE CUSTOMER] userId:", userId);

    // 🔥 Validaciones
    if (!userId) {
      console.warn("[CREATE CUSTOMER] Missing x-user-id");
      return NextResponse.json(
        { error: "Missing x-user-id header" },
        { status: 400 },
      );
    }

    if (!body.name || !body.email) {
      console.warn("[CREATE CUSTOMER] Missing name/email");
      return NextResponse.json(
        { error: "name and email are required" },
        { status: 400 },
      );
    }

    const url = `${base}/customers`;
    console.log("[CREATE CUSTOMER] Fetching:", url);

    // 🔹 Request al backend real
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-user-id": userId, // ✅ clave
      },
      body: JSON.stringify({
        name: body.name,
        email: body.email,
      }),
    });

    console.log("[CREATE CUSTOMER] Response status:", res.status);

    if (!res.ok) {
      const errorText = await res.text();
      console.error("[CREATE CUSTOMER] Error response body:", errorText);

      return NextResponse.json(
        { error: errorText || "Error al crear customer" },
        { status: res.status },
      );
    }

    const data = await res.json();
    console.log("[CREATE CUSTOMER] Response data:", data);

    return NextResponse.json(data);
  } catch (error) {
    console.error("[CREATE CUSTOMER] Internal error:", error);

    return NextResponse.json(
      { error: "Error interno al crear customer" },
      { status: 500 },
    );
  }
}
