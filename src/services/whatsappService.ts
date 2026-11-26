// src/services/whatsappService.ts
import axios from "axios";

const API_URL = process.env.NEXT_PUBLIC_API_INTEGRATIONS || "http://localhost:3007";

export interface WhatsAppStatus {
  status: string;
  wabaId?: string;
  tier?: string;
  quality?: string;
  phoneNumberId?: string;
  dailyLimit?: string;
  webhookVerified?: boolean;
}

export interface ConnectWabaPayload {
  wabaId: string;
  phoneNumberId: string;
  accessToken: string;
  /** Opcional: ms-integrations lee el número de Meta; el escrito solo se compara. */
  businessPhoneNumber?: string;
  storeId: string;
  /** Guardar como número de toda la empresa (lo usan las tiendas sin número propio). */
  asCompanyDefault?: boolean;
  /** La persona aceptó que un número sin coexistencia deja la app del celular. */
  confirmNoCoexistence?: boolean;
  /** La persona aceptó guardar el número de Meta cuando el escrito no coincide. */
  confirmPhoneFromMeta?: boolean;
}

export async function connectCustomWaba(token: string, payload: ConnectWabaPayload) {
  const { storeId, ...body } = payload;
  const res = await axios.post(
    `${API_URL}/whatsapp/onboarding/${encodeURIComponent(storeId)}/connect-custom-waba`,
    body,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  return res.data;
}
export async function getWhatsAppStatus(token: string, storeId: string): Promise<WhatsAppStatus> {
  try {
    const response = await axios.get(`${API_URL}/wa/status`, {
      headers: { Authorization: `Bearer ${token}` },
      params: { storeId },
    });
    return response.data;
  } catch (error) {
    console.error("Error al obtener el estado de WhatsApp:", error);
    return { status: "PENDING" };
  }
}

export async function getWhatsAppAccounts(token: string, storeId: string) {
  try {
    const response = await axios.get(`${API_URL}/wa/accounts`, {
      headers: { Authorization: `Bearer ${token}` },
      params: { storeId },
    });
    return response.data;
  } catch (error) {
    console.error("Error al obtener las cuentas de WhatsApp:", error);
    throw error;
  }
}

export async function refreshWhatsAppAccount(token: string, accountId: string) {
  try {
    const response = await axios.post(
      `${API_URL}/wa/accounts/${accountId}/refresh`,
      {},
      { headers: { Authorization: `Bearer ${token}` } },
    );
    return response.data;
  } catch (error) {
    // Muestra la causa que dio el backend (p. ej. token de Meta vencido) en vez del error de axios.
    const message = axios.isAxiosError(error) ? error.response?.data?.message : null;
    throw typeof message === "string" && message ? new Error(message) : error;
  }
}

export async function disconnectWhatsAppAccount(token: string, accountId: string) {
  const response = await axios.post(
    `${API_URL}/wa/accounts/${accountId}/disconnect`,
    {},
    { headers: { Authorization: `Bearer ${token}` } },
  );
  return response.data;
}
