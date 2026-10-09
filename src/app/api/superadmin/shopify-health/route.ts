import { NextResponse } from "next/server";
import axios from "axios";
import { SUPERADMIN_EMAILS } from "@/config/permissions.config";

/**
 * FEAT-22 M3 — proxy a GET /shopify/health; el token interno no sale del servidor.
 *
 * El middleware de /api/superadmin solo decodifica el JWT (no verifica la firma),
 * y esta ruta usa un token de servicio que ve todas las empresas: por eso antes
 * de usarlo se le pide a ms-auth que valide el JWT (`/auth/user/me`) y se exige
 * que el email sea de superadmin.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader) {
    return NextResponse.json({ error: "No authorization header" }, { status: 401 });
  }

  const apiIntegrations = process.env.NEXT_PUBLIC_API_INTEGRATIONS;
  const apiUsers = process.env.NEXT_PUBLIC_API_USERS;
  const token = process.env.INTERNAL_SERVICE_TOKEN;
  if (!apiIntegrations || !apiUsers || !token) {
    return NextResponse.json(
      { error: "Falta configurar NEXT_PUBLIC_API_INTEGRATIONS, NEXT_PUBLIC_API_USERS o INTERNAL_SERVICE_TOKEN" },
      { status: 500 },
    );
  }

  let email: string | undefined;
  try {
    const me = await axios.get(`${apiUsers}/auth/user/me`, {
      headers: { Authorization: authHeader },
      timeout: 5000,
    });
    email = (me.data?.email as string | undefined)?.toLowerCase();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!email || !SUPERADMIN_EMAILS.includes(email)) {
    return NextResponse.json({ error: "Forbidden: Superadmin access required" }, { status: 403 });
  }

  try {
    const res = await axios.get(`${apiIntegrations}/shopify/health`, {
      headers: { "x-internal-token": token },
      timeout: 10000,
    });
    return NextResponse.json(res.data);
  } catch (err: any) {
    console.error("shopify-health:", err?.response?.status ?? err?.message);
    return NextResponse.json({ error: "No se pudo consultar ms-integrations" }, { status: 502 });
  }
}
