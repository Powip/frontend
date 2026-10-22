import { proxyMerchantMercadoPagoConnect } from "@/lib/server/merchantMercadoPagoProxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ storeId: string }> }) {
  return proxyMerchantMercadoPagoConnect(request, (await context.params).storeId);
}
