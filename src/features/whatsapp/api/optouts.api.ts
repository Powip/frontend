import { API } from "@/lib/api";
import axiosAuth from "@/lib/axiosAuth";
import { assertWhatsAppContractAvailable } from "../constants/whatsapp-contracts";

/** Ítem de GET /wa/optouts (C-25). */
export interface WhatsAppOptOutDto {
  id: string;
  customerName: string | null;
  phone: string;
  /** null = aplica a todas las tiendas. */
  storeId: string | null;
  storeName: string | null;
  origin: string | null;
  note: string | null;
  createdAt: string;
  createdBy: { id: string; name: string } | null;
  version: number;
}

export interface WhatsAppOptOutsPageDto {
  items: WhatsAppOptOutDto[];
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
}

const OPTOUTS_URL = `${API.integrations}/wa/optouts`;

// C-25 · GET /wa/optouts?storeId=&q=&page=&pageSize=
export async function listWhatsAppOptOuts(params: {
  storeId: string;
  q?: string;
  page?: number;
  pageSize?: number;
}): Promise<WhatsAppOptOutsPageDto> {
  assertWhatsAppContractAvailable("optOuts");
  const { data } = await axiosAuth.get<WhatsAppOptOutsPageDto>(OPTOUTS_URL, { params });
  return data;
}

// C-25 · POST /wa/optouts
export async function createWhatsAppOptOut(body: {
  phone: string;
  storeId: string | null;
  customerName?: string | null;
  origin?: "manual" | "agent";
  note?: string | null;
}): Promise<WhatsAppOptOutDto> {
  assertWhatsAppContractAvailable("optOuts");
  const { data } = await axiosAuth.post<WhatsAppOptOutDto>(OPTOUTS_URL, body);
  return data;
}

// C-25 · POST /wa/optouts/:id/reactivate con If-Match
export async function reactivateWhatsAppOptOut(
  id: string,
  version: number,
  note: string,
): Promise<void> {
  assertWhatsAppContractAvailable("optOuts");
  await axiosAuth.post(
    `${OPTOUTS_URL}/${encodeURIComponent(id)}/reactivate`,
    { reason: "customer_request", note },
    { headers: { "If-Match": String(version) } },
  );
}
