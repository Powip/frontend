import { API } from "@/lib/api";
import axiosAuth from "@/lib/axiosAuth";
import { assertWhatsAppContractAvailable } from "../constants/whatsapp-contracts";

/** Ítem de GET /wa/messages (C-24 / C-19). */
export interface WhatsAppMessageDto {
  id: string;
  createdAt: string;
  orderId: string | null;
  orderNumber: string;
  customerName: string | null;
  phone: string | null;
  templateName: string | null;
  ruleKey: string;
  courier: string | null;
  status: string;
  reasonCode: string | null;
  reason: string | null;
  timeline: {
    queuedAt: string;
    sentAt: string | null;
    deliveredAt: string | null;
    readAt: string | null;
    failedAt: string | null;
  };
}

export interface WhatsAppMessagesPageDto {
  items: WhatsAppMessageDto[];
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
}

/** Respuesta de GET /wa/queue/upcoming (C-20). */
export interface WhatsAppUpcomingQueueDto {
  total: number;
  groups: Array<{
    sendAt: string;
    templateName: string | null;
    ruleKey: string;
    source: string;
    sourceLabel: string;
    orders: number;
    deferred: boolean;
    deferredTo: string | null;
    reason: string | null;
  }>;
}

/** Medianoche de hoy en Lima (UTC-5, sin horario de verano) en ISO UTC. */
export function limaTodayStartIso(now = new Date()): string {
  const lima = new Date(now.getTime() - 5 * 60 * 60 * 1000);
  return new Date(
    Date.UTC(lima.getUTCFullYear(), lima.getUTCMonth(), lima.getUTCDate(), 5, 0, 0),
  ).toISOString();
}

// C-24 / C-19 · GET /wa/messages?storeId=&status=&from=&to=&page=&pageSize=
export async function listWhatsAppMessages(params: {
  storeId: string;
  status?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}): Promise<WhatsAppMessagesPageDto> {
  assertWhatsAppContractAvailable("messages");
  const { data } = await axiosAuth.get<WhatsAppMessagesPageDto>(`${API.integrations}/wa/messages`, {
    params,
  });
  return data;
}

// C-20 · GET /wa/queue/upcoming?storeId=&hours=24
export async function getWhatsAppUpcomingQueue(
  storeId: string,
  hours = 24,
): Promise<WhatsAppUpcomingQueueDto> {
    assertWhatsAppContractAvailable("upcomingQueue");
  const { data } = await axiosAuth.get<WhatsAppUpcomingQueueDto>(
    `${API.integrations}/wa/queue/upcoming`,
    { params: { storeId, hours } },
  );
  return data;
}