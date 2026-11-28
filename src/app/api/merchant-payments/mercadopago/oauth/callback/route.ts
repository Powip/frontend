import { proxyMerchantMercadoPagoCallback } from "@/lib/server/merchantMercadoPagoProxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return proxyMerchantMercadoPagoCallback(request);
}
