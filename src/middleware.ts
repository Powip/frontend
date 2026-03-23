import { NextResponse, type NextRequest } from "next/server";
import { SUPERADMIN_EMAILS } from "@/config/permissions.config";

/**
 * Decodifica el payload de un JWT sin verificar firma (solo para leer el email).
 * La verificación real de la firma ocurre en el apigateway (ms-auth).
 */
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    // Base64url → Base64 → JSON
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = atob(base64);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  // Protect /api/superadmin routes using the custom JWT from the backend
  if (request.nextUrl.pathname.startsWith("/api/superadmin")) {
    const authHeader = request.headers.get("Authorization");

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const payload = decodeJwtPayload(token);

    if (!payload) {
      return NextResponse.json({ error: "Unauthorized: invalid token" }, { status: 401 });
    }

    const email = (payload.email as string | undefined)?.toLowerCase();
    const exp = payload.exp as number | undefined;

    // Verify token is not expired
    if (exp && Math.floor(Date.now() / 1000) > exp) {
      return NextResponse.json({ error: "Unauthorized: token expired" }, { status: 401 });
    }

    // Verify email is in the superadmin whitelist
    if (!email || !SUPERADMIN_EMAILS.includes(email)) {
      return NextResponse.json({ error: "Forbidden: Superadmin access required" }, { status: 403 });
    }
  }

  return NextResponse.next({
    request: {
      headers: request.headers,
    },
  });
}

export const config = {
  matcher: [
    "/api/superadmin/:path*",
  ],
};
