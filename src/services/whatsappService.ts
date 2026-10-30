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
  businessPhoneNumber: string;
  storeId: string
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

export async function updateWhatsAppAccount(
  token: string, 
  accountId: string, 
  connectionType: string, 
  ifMatchVersion?: number
) {
  const headers: Record<string, string> = { 
    Authorization: `Bearer ${token}` 
  };
  
  if (ifMatchVersion !== undefined) {
    headers["if-match"] = ifMatchVersion.toString();
  }

  const response = await axios.put(
    `${API_URL}/wa/accounts/${accountId}`,
    { connectionType },
    { headers }
  );
  return response.data;
}

export async function refreshWhatsAppAccount(token: string, accountId: string) {
  const response = await axios.post(
    `${API_URL}/wa/accounts/${accountId}/refresh`,
    {},
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return response.data;
}

export async function disconnectWhatsAppAccount(token: string, accountId: string) {
  const response = await axios.post(
    `${API_URL}/wa/accounts/${accountId}/disconnect`,
    {},
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return response.data;
}