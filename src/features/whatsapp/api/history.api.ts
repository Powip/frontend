import { API } from "@/lib/api";
import axiosAuth from "@/lib/axiosAuth";
import { assertWhatsAppContractAvailable } from "../constants/whatsapp-contracts";
import { WHATSAPP_MESSAGE_STATUSES, type WhatsAppMessageStatus } from "../enums/whatsapp.enums";
import type {
  WhatsAppHistoryMessage,
  WhatsAppHistoryMetrics,
  WhatsAppHistoryPage,
  WhatsAppHistoryQuery,
} from "../models/history.model";
import { toWhatsAppApiError } from "./threads.api";

const BASE = `${API.integrations}/wa/messages`;

// ───────── DTO de C-24 (ms-integrations · wa-hub.ops.service historyDto) ─────────

interface HistoryMessageDto {
  id: string;
  createdAt: string;
  orderId: string | null;
  orderNumber: string | null;
  storeId: string | null;
  storeName: string | null;
  customerName: string | null;
  phone: string | null;
  templateName: string | null;
  courierName: string | null;
  status: string;
  reason: string | null;
  timeline: {
    queuedAt: string | null;
    sentAt: string | null;
    deliveredAt: string | null;
    readAt: string | null;
    failedAt: string | null;
    clickedAt: string | null;
  };
  assistedBy: string | null;
  canResend: boolean;
  resendBlockedReason: string | null;
}

interface HistoryPageDto {
  items: HistoryMessageDto[];
  page: number;
  pageSize: number;
  total: number;
  hasMore?: boolean;
}

interface HistoryMetricsDto {
  sent: number;
  delivered: number;
  read: number;
  trackingOpened: number;
  notSent: number;
  notSentBreakdown: { reason: string; label: string; count: number }[];
  assisted: number;
  computedAt: string;
}

const KNOWN_STATUSES = new Set<string>(Object.values(WHATSAPP_MESSAGE_STATUSES));

const toDate = (value: string | null | undefined): Date | null => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const toStatus = (value: string): WhatsAppMessageStatus =>
  KNOWN_STATUSES.has(value) ? (value as WhatsAppMessageStatus) : WHATSAPP_MESSAGE_STATUSES.SKIPPED;

export function toHistoryMessage(
  dto: HistoryMessageDto,
  storeNames: ReadonlyMap<string, string>,
): WhatsAppHistoryMessage {
  const storeId = dto.storeId ?? "";
  return {
    id: dto.id,
    createdAt: toDate(dto.createdAt) ?? new Date(0),
    orderId: dto.orderId,
    orderNumber: dto.orderNumber || null,
    storeId,
    storeName: dto.storeName ?? storeNames.get(storeId) ?? "Tienda sin nombre",
    customerName: dto.customerName,
    phone: dto.phone ?? "",
    templateName: dto.templateName,
    courierName: dto.courierName,
    status: toStatus(dto.status),
    reason: dto.reason,
    timeline: {
      queuedAt: toDate(dto.timeline?.queuedAt),
      sentAt: toDate(dto.timeline?.sentAt),
      deliveredAt: toDate(dto.timeline?.deliveredAt),
      readAt: toDate(dto.timeline?.readAt),
      failedAt: toDate(dto.timeline?.failedAt),
      clickedAt: toDate(dto.timeline?.clickedAt),
    },
    assistedBy: dto.assistedBy ? { id: "", name: dto.assistedBy } : null,
    canResend: dto.canResend,
    resendBlockedReason: dto.resendBlockedReason,
  };
}

function toParams(query: WhatsAppHistoryQuery, status?: string) {
  return {
    period: query.period,
    from: query.from,
    to: query.to,
    storeId: query.storeId ?? undefined,
    q: query.q ?? undefined,
    status: status && status !== "all" ? status : undefined,
  };
}

/** C-24.1: tabla paginada; el filtro de estado aplica solo aquí y en la exportación (D-67). */
export async function getWhatsAppHistory(
  query: WhatsAppHistoryQuery,
  status: string,
  page: number,
  pageSize: number,
  storeNames: ReadonlyMap<string, string>,
): Promise<WhatsAppHistoryPage> {
  assertWhatsAppContractAvailable("messages");
  const { data } = await axiosAuth.get<HistoryPageDto>(`${BASE}/history`, {
    params: { ...toParams(query, status), page, pageSize },
  });
  return {
    items: data.items.map((item) => toHistoryMessage(item, storeNames)),
    page: data.page,
    pageSize: data.pageSize,
    total: data.total,
    hasMore: data.hasMore ?? data.page * data.pageSize < data.total,
  };
}

/** C-24.2: indicadores del periodo y la tienda (sin filtro de estado). */
export async function getWhatsAppHistoryMetrics(
  query: WhatsAppHistoryQuery,
): Promise<WhatsAppHistoryMetrics> {
  assertWhatsAppContractAvailable("messages");
  const { data } = await axiosAuth.get<HistoryMetricsDto>(`${BASE}/metrics`, {
    params: toParams(query),
  });
  return {
    sent: data.sent,
    delivered: data.delivered,
    read: data.read,
    trackingOpened: data.trackingOpened,
    notSent: data.notSent,
    notSentBreakdown: data.notSentBreakdown ?? [],
    assisted: data.assisted,
    computedAt: toDate(data.computedAt) ?? new Date(),
  };
}

/** C-24.3: el servidor arma el archivo con todas las páginas (D-64); aquí solo se descarga. */
export async function downloadWhatsAppHistory(query: WhatsAppHistoryQuery, status: string): Promise<void> {
  assertWhatsAppContractAvailable("messages");
  try {
    const response = await axiosAuth.get<Blob>(`${BASE}/export`, {
      params: toParams(query, status),
      responseType: "blob",
    });
    const disposition = String(response.headers?.["content-disposition"] ?? "");
    const fileName =
      /filename="?([^";]+)"?/.exec(disposition)?.[1] ??
      `historial-whatsapp-${new Date().toISOString().slice(0, 10)}.csv`;
    const url = URL.createObjectURL(response.data);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  } catch (error) {
    throw toWhatsAppApiError(error, "No se pudo generar el archivo.");
  }
}

/** C-24.4: reenvía un aviso fallido u omitido; vuelve a la cola con una clave de idempotencia. */
export async function resendWhatsAppHistoryMessage(messageId: string): Promise<void> {
  assertWhatsAppContractAvailable("messages");
  try {
    await axiosAuth.post(
      `${BASE}/${encodeURIComponent(messageId)}/resend`,
      {},
      {
        headers: {
          "Idempotency-Key":
            typeof crypto !== "undefined" && "randomUUID" in crypto
              ? crypto.randomUUID()
              : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        },
      },
    );
  } catch (error) {
    throw toWhatsAppApiError(error, "No se pudo reenviar el aviso.");
  }
}
