import axios from "axios";
import axiosAuth from "@/lib/axiosAuth";
import { GATEWAY } from "@/lib/gateway";
import type { PlanBilling, PlanChangePreview } from "@/types/planBilling";

const BASE = `${GATEWAY.subscription}/subscriptions/billing`;

export const fetchPlanBilling = async (): Promise<PlanBilling> =>
  (await axiosAuth.get<PlanBilling>(BASE)).data;

export const previewPlanChange = async (planId: string): Promise<PlanChangePreview> =>
  (await axiosAuth.post<PlanChangePreview>(`${BASE}/change-plan/preview`, { planId })).data;

export const changePlan = async (planId: string): Promise<PlanBilling> =>
  (await axiosAuth.post<PlanBilling>(`${BASE}/change-plan`, { planId })).data;

export const undoPlanChange = async (): Promise<PlanBilling> =>
  (await axiosAuth.delete<PlanBilling>(`${BASE}/change-plan`)).data;

/** También deshace la baja de un add-on que todavía no venció. */
export const addAddOn = async (addOnId: string): Promise<PlanBilling> =>
  (await axiosAuth.post<PlanBilling>(`${BASE}/add-ons`, { addOnId })).data;

export const removeAddOn = async (addOnId: string): Promise<PlanBilling> =>
  (await axiosAuth.delete<PlanBilling>(`${BASE}/add-ons/${addOnId}`)).data;

export const cancelSubscription = async (): Promise<PlanBilling> =>
  (await axiosAuth.post<PlanBilling>(`${BASE}/cancel`)).data;

const MESSAGES: Record<string, string> = {
  NOT_ADMIN: "Solo el administrador de la cuenta puede hacer cambios en el plan.",
  NO_FLOW_SUBSCRIPTION: "Tu suscripción no está en Flow. Pásate a Flow para poder hacer cambios.",
  PLAN_NOT_AVAILABLE: "Ese plan no está disponible para el cambio.",
  SAME_PLAN: "Ya estás en ese plan.",
  PENDING_INVOICE: "Tienes un cobro pendiente en Flow. Cuando se pague podrás cambiar de plan.",
  ADDON_NOT_AVAILABLE: "Ese add-on no está disponible.",
  ADDON_ALREADY_ACTIVE: "Ya tienes ese add-on.",
  ADDON_NOT_FOUND: "No tienes ese add-on.",
  FLOW_UNAVAILABLE: "No pudimos comunicarnos con Flow. Intenta de nuevo en unos minutos.",
};

/** Mensaje en español para el `code` que devuelve ms-subscription. */
export function billingErrorMessage(err: unknown): string {
  const code = axios.isAxiosError(err) ? (err.response?.data as { code?: string })?.code : undefined;
  return (code && MESSAGES[code]) || "No se pudo completar la operación. Intenta de nuevo.";
}
