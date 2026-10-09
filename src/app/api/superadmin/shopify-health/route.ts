import { NextResponse } from "next/server";
import axios from "axios";

const API_INTEGRATIONS = process.env.NEXT_PUBLIC_API_INTEGRATIONS;

/** FEAT-22 M3 — proxy a GET /shopify/health; el token interno no sale del servidor. */
export async function GET(request: Request) {
  if (!request.headers.get("Authorization")) {
    return NextResponse.json({ error: "No authorization header" }, { status: 401 });
  }
  const token = process.env.INTERNAL_SERVICE_TOKEN;
  if (!API_INTEGRATIONS || !token) {
    return NextResponse.json(
      { error: "Falta configurar NEXT_PUBLIC_API_INTEGRATIONS o INTERNAL_SERVICE_TOKEN" },
      { status: 500 },
    );
  }
  try {
    const res = await axios.get(`${API_INTEGRATIONS}/shopify/health`, {
      headers: { "x-internal-token": token },
      timeout: 10000,
    });
    return NextResponse.json(res.data);
  } catch (err: any) {
    console.error("shopify-health:", err?.response?.status ?? err?.message);
    return NextResponse.json({ error: "No se pudo consultar ms-integrations" }, { status: 502 });
  }
}
