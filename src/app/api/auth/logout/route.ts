import type { NextRequest } from "next/server";
import { proxyAuthRequest } from "@/lib/server/authProxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function POST(request: NextRequest) {
  return proxyAuthRequest(request, "logout");
}
