import axiosAuth from "@/lib/axiosAuth";
import { GATEWAY } from "@/lib/gateway";
import type { BuyExtraRucInput, ExtraRucPurchase, ExtraRucSummary } from "../models/extra-ruc";

const BASE = `${GATEWAY.subscription}/subscriptions/billing/extra-rucs`;

export async function getExtraRucSummaryApi(): Promise<ExtraRucSummary> {
  return (await axiosAuth.get<ExtraRucSummary>(BASE)).data;
}

/** Crea la compra en PENDING y devuelve redirectUrl: la página de pago de Flow. */
export async function buyExtraRucApi(input: BuyExtraRucInput): Promise<ExtraRucPurchase> {
  return (await axiosAuth.post<ExtraRucPurchase>(BASE, input)).data;
}

export async function getExtraRucPurchaseApi(id: string): Promise<ExtraRucPurchase> {
  return (await axiosAuth.get<ExtraRucPurchase>(`${BASE}/${id}`)).data;
}

/** Da de baja un RUC extra: no se renueva y vale hasta el final del período ya pagado. */
export async function cancelExtraRucApi(id: string): Promise<ExtraRucPurchase> {
  return (await axiosAuth.delete<ExtraRucPurchase>(`${BASE}/${id}`)).data;
}
