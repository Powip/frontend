import { NextResponse } from "next/server";

export async function GET() {
  const base = (process.env.NEXT_PUBLIC_API_GATEWAY || "http://localhost:8083").replace(/\/$/, "") + "/subscription";

  console.log("[GET ADD-ONS] Base URL:", base);

  try {
    const url = `${base}/add-ons`;
    console.log("[GET ADD-ONS] Fetching:", url);

    const res = await fetch(url, {
      cache: "no-store",
    });

    console.log("[GET ADD-ONS] Response status:", res.status);

    if (!res.ok) {
      const errorText = await res.text();
      console.error("[GET ADD-ONS] Error response body:", errorText);

      return NextResponse.json(
        { error: "Error al obtener add-ons" },
        { status: res.status },
      );
    }

    const data: unknown = await res.json();
    console.log("[GET ADD-ONS] Response data:", data);

    return NextResponse.json(data);
  } catch (error) {
    console.error("[GET ADD-ONS] Internal error:", error);

    return NextResponse.json(
      { error: "Error interno al obtener add-ons" },
      { status: 500 },
    );
  }
}
