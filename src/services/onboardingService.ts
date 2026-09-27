import axios from "axios";
import axiosAuth from "@/lib/axiosAuth";
import { GATEWAY } from "@/lib/gateway";
import type {
  BackendAddOn,
  BackendPlan,
  FlowCheckoutResponse,
  SubscriptionMe,
} from "@/types/onboarding";

/**
 * Llamadas del onboarding (FEAT-11).
 *
 * - Registro y login van a ms-auth por NEXT_PUBLIC_API_USERS (el mismo host que
 *   LoginForm): ms-auth deja la cookie httpOnly de refresh en SU dominio y el
 *   silentRefresh de AuthContext la busca ahí. Por el gateway la cookie quedaría
 *   en otro dominio y la sesión se perdería al volver de Flow.
 * - Todo lo de suscripción va por el gateway (/subscription/** → ms-subscription)
 *   con el JWT real; ms-subscription saca el usuario del token.
 */
const API_USERS = (process.env.NEXT_PUBLIC_API_USERS ?? "").replace(/\/$/, "");

export interface RegisterPayload {
  name: string;
  surname: string;
  email: string;
  password: string;
  phoneNumber: string;
  identityDocument: string;
  address: string;
  district: string;
}

export async function registerAccount(payload: RegisterPayload): Promise<{ userId: string }> {
  const { data } = await axios.post<{ userId: string }>(`${API_USERS}/auth/register`, payload);
  return data;
}

export async function loginAccount(email: string, password: string): Promise<{ accessToken: string }> {
  const { data } = await axios.post<{ accessToken: string }>(
    `${API_USERS}/auth/login`,
    { email, password },
    { withCredentials: true },
  );
  return data;
}

export async function fetchPlans(): Promise<BackendPlan[]> {
  const { data } = await axiosAuth.get<BackendPlan[]>(`${GATEWAY.subscription}/plans`);
  return Array.isArray(data) ? data : [];
}

export async function fetchAddOns(signal?: AbortSignal): Promise<BackendAddOn[]> {
  const { data } = await axiosAuth.get<BackendAddOn[]>(`${GATEWAY.subscription}/add-ons`, { signal });
  return Array.isArray(data) ? data : [];
}

export async function startFlowCheckout(planId: string, addOnIds: string[]): Promise<FlowCheckoutResponse> {
  const { data } = await axiosAuth.post<FlowCheckoutResponse>(
    `${GATEWAY.subscription}/subscriptions/flow/checkout`,
    { planId, addOnIds },
  );
  return data;
}

/** 200 → suscripción; 202 (CARD_PENDING) → Flow todavía no asentó la tarjeta. */
export async function confirmFlowCheckout(
  token: string,
): Promise<{ pending: true } | { pending: false; subscription: SubscriptionMe }> {
  const res = await axiosAuth.post<SubscriptionMe>(
    `${GATEWAY.subscription}/subscriptions/flow/confirm`,
    { token },
    { validateStatus: (s) => s === 200 || s === 202 },
  );
  return res.status === 202 ? { pending: true } : { pending: false, subscription: res.data };
}

export async function fetchMySubscription(accessToken?: string): Promise<SubscriptionMe | null> {
  const { data } = await axiosAuth.get<SubscriptionMe | null>(
    `${GATEWAY.subscription}/subscriptions/me`,
    accessToken ? { headers: { Authorization: `Bearer ${accessToken}` } } : undefined,
  );
  return data ?? null;
}

/** Mensaje legible a partir del { code, error } que devuelve ms-subscription. */
export function apiErrorCode(err: unknown): string | undefined {
  return axios.isAxiosError(err) ? (err.response?.data as { code?: string })?.code : undefined;
}
