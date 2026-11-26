import { isAxiosError } from "axios";
import { API } from "@/lib/api";
import axiosAuth from "@/lib/axiosAuth";
import { assertWhatsAppContractAvailable } from "../constants/whatsapp-contracts";
import {
  WHATSAPP_MESSAGE_KINDS,
  WHATSAPP_MESSAGE_STATUSES,
  WHATSAPP_THREAD_COLUMNS,
  type WhatsAppEvidenceType,
  type WhatsAppMediaType,
  type WhatsAppMessageKind,
  type WhatsAppMessageStatus,
  type WhatsAppThreadColumn,
} from "../enums/whatsapp.enums";
import type {
  WhatsAppConversationBoard,
  WhatsAppConversationColumnPage,
  WhatsAppConversationDetail,
  WhatsAppConversationListPage,
  WhatsAppConversationQuery,
  WhatsAppConversationSummary,
  WhatsAppQuickReply,
} from "../models/conversation.model";
import type { WhatsAppMessage, WhatsAppMessageAuthor } from "../models/message.model";

const BASE = `${API.integrations}/wa`;

// ───────── DTO de C-22 (ms-integrations · wa-hub.threads.service) ─────────

interface AuthorDto {
  id: string | null;
  name: string;
}

interface SummaryDto {
  id: string;
  orderId: string | null;
  orderNumber: string | null;
  storeId: string | null;
  storeName: string | null;
  courierName: string | null;
  customerName: string | null;
  phone: string;
  lastMessageAt: string | null;
  column: WhatsAppThreadColumn;
  lastOutbound: {
    messageId: string | null;
    status: string;
    templateName: string | null;
    sentAt: string | null;
    failureReason: string | null;
  } | null;
  attention: {
    pendingReply: boolean;
    lastInboundText: string | null;
    lastInboundAt: string | null;
    waitingSince: string | null;
    overdue: boolean | null;
    attended: boolean;
    attendedAt: string | null;
    attendedBy: AuthorDto | null;
  };
  trackingOpened: boolean;
  flaggedForReview: boolean;
  optedOut: boolean;
  assignee: AuthorDto | null;
  version: number;
}

interface MessageDto {
  id: string;
  direction: "in" | "out";
  kind: string;
  templateName: string | null;
  header?: string | null;
  body: string | null;
  buttonText: string | null;
  media: { type: string; url: string | null; caption: string | null } | null;
  evidence: {
    type: string | null;
    imageUrl: string | null;
    courier: string | null;
    takenAt: string | null;
  } | null;
  status: string | null;
  sentAt: string | null;
  deliveredAt: string | null;
  readAt: string | null;
  failedAt: string | null;
  errorCode?: string | null;
  errorMessage: string | null;
  author: AuthorDto | null;
  internalNote: boolean;
  createdAt: string;
}

export interface ThreadDetailDto extends SummaryDto {
  replyWindow: { open: boolean | null; expiresAt: string | null } | null;
  trackingUrl: string | null;
  messages: MessageDto[];
}

interface ListPageDto {
  items: SummaryDto[];
  page: number;
  pageSize: number;
  total: number;
}

interface BoardDto {
  columns: Record<WhatsAppThreadColumn, { items: SummaryDto[]; total: number; hasMore: boolean }>;
  page: number;
  pageSize: number;
}

// ───────── mapeo a los modelos de pantalla ─────────

const KNOWN_STATUSES = new Set<string>(Object.values(WHATSAPP_MESSAGE_STATUSES));
const KNOWN_KINDS = new Set<string>(Object.values(WHATSAPP_MESSAGE_KINDS));
const COLUMNS = Object.values(WHATSAPP_THREAD_COLUMNS);

const toDate = (value: string | null | undefined): Date | null => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const toStatus = (value: string | null | undefined): WhatsAppMessageStatus => {
  if (value === "cancelled") return WHATSAPP_MESSAGE_STATUSES.SKIPPED;
  return value && KNOWN_STATUSES.has(value)
    ? (value as WhatsAppMessageStatus)
    : WHATSAPP_MESSAGE_STATUSES.QUEUED;
};

const toAuthor = (dto: AuthorDto | null): WhatsAppMessageAuthor | null =>
  dto ? { id: dto.id ?? "", name: dto.name } : null;

/** Lo que el servidor deja en null (tienda única / sin tienda) se completa con la lista local. */
export type StoreNames = ReadonlyMap<string, string>;

export function toConversationSummary(
  dto: SummaryDto,
  storeNames: StoreNames,
): WhatsAppConversationSummary {
  const storeId = dto.storeId ?? "";
  return {
    id: dto.id,
    orderId: dto.orderId,
    orderNumber: dto.orderNumber,
    storeId,
    storeName: dto.storeName ?? storeNames.get(storeId) ?? "Sin tienda",
    courierName: dto.courierName,
    customerName: dto.customerName,
    phone: dto.phone,
    lastMessageAt: toDate(dto.lastMessageAt),
    lastOutbound: dto.lastOutbound
      ? {
          messageId: dto.lastOutbound.messageId,
          status: toStatus(dto.lastOutbound.status),
          templateName: dto.lastOutbound.templateName,
          sentAt: toDate(dto.lastOutbound.sentAt),
          failureReason: dto.lastOutbound.failureReason,
        }
      : null,
    attention: {
      pendingReply: dto.attention.pendingReply,
      lastInboundText: dto.attention.lastInboundText,
      lastInboundAt: toDate(dto.attention.lastInboundAt),
      waitingSince: toDate(dto.attention.waitingSince),
      overdue: dto.attention.overdue,
      attended: dto.attention.attended,
      attendedAt: toDate(dto.attention.attendedAt),
      attendedBy: toAuthor(dto.attention.attendedBy),
    },
    trackingOpened: dto.trackingOpened,
    flaggedForReview: dto.flaggedForReview,
    optedOut: dto.optedOut,
    assignee: toAuthor(dto.assignee),
  };
}

export function toConversationMessage(dto: MessageDto): WhatsAppMessage {
  const kind: WhatsAppMessageKind = dto.internalNote
    ? WHATSAPP_MESSAGE_KINDS.NOTE
    : KNOWN_KINDS.has(dto.kind)
      ? (dto.kind as WhatsAppMessageKind)
      : WHATSAPP_MESSAGE_KINDS.TEXT;
  const isDocument = dto.media?.type === "document";
  return {
    id: dto.id,
    direction: dto.direction,
    kind,
    status: dto.status ? toStatus(dto.status) : null,
    body: [dto.header, dto.body].filter(Boolean).join("\n\n"),
    templateName: dto.templateName,
    buttonText: dto.buttonText,
    document:
      isDocument && dto.media
        ? { fileName: dto.media.caption ?? "Documento", sizeBytes: null, url: dto.media.url }
        : null,
    media:
      dto.media && !isDocument
        ? {
            type: dto.media.type as WhatsAppMediaType,
            url: dto.media.url,
            caption: dto.media.caption,
          }
        : null,
    evidence: dto.evidence
      ? {
          type: (dto.evidence.type as WhatsAppEvidenceType | null) ?? null,
          imageUrl: dto.evidence.imageUrl,
          courier: dto.evidence.courier,
          takenAt: toDate(dto.evidence.takenAt),
        }
      : null,
    author: toAuthor(dto.author),
    failureReason: dto.errorMessage,
    createdAt: toDate(dto.createdAt) ?? new Date(0),
    timeline: {
      sentAt: toDate(dto.sentAt),
      deliveredAt: toDate(dto.deliveredAt),
      readAt: toDate(dto.readAt),
      failedAt: toDate(dto.failedAt),
      clickedAt: null,
    },
  };
}

export function toConversationDetail(
  dto: ThreadDetailDto,
  storeNames: StoreNames,
): WhatsAppConversationDetail {
  return {
    ...toConversationSummary(dto, storeNames),
    replyWindow: dto.replyWindow
      ? { open: dto.replyWindow.open, expiresAt: toDate(dto.replyWindow.expiresAt) }
      : null,
    trackingUrl: dto.trackingUrl,
    messages: (dto.messages ?? []).map(toConversationMessage),
    version: dto.version,
  };
}

/** Error legible para la pantalla: usa el `message` del cuerpo C-00.4 cuando viene. */
export function toWhatsAppApiError(error: unknown, fallback: string): Error {
  if (isAxiosError(error)) {
    const body = error.response?.data as { message?: unknown; code?: unknown } | undefined;
    const message = typeof body?.message === "string" && body.message ? body.message : fallback;
    const wrapped = new Error(message) as Error & { code?: string; status?: number };
    wrapped.code = typeof body?.code === "string" ? body.code : undefined;
    wrapped.status = error.response?.status;
    return wrapped;
  }
  return error instanceof Error ? error : new Error(fallback);
}

const newIdempotencyKey = (): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

function toParams(query: WhatsAppConversationQuery) {
  return {
    q: query.q ?? undefined,
    storeId: query.storeId ?? undefined,
    assignedTo: query.assignedTo ?? undefined,
  };
}

async function run<T>(fallback: string, request: () => Promise<T>): Promise<T> {
  try {
    return await request();
  } catch (error) {
    throw toWhatsAppApiError(error, fallback);
  }
}

// ───────── C-22.1 tablero / lista ─────────

export async function getWhatsAppConversationBoard(
  query: WhatsAppConversationQuery,
  storeNames: StoreNames,
  pageSize: number,
): Promise<WhatsAppConversationBoard> {
  assertWhatsAppContractAvailable("threads");
  const { data } = await axiosAuth.get<BoardDto>(`${BASE}/threads`, {
    params: { ...toParams(query), page: 1, pageSize },
  });
  return Object.fromEntries(
    COLUMNS.map((column): [WhatsAppThreadColumn, WhatsAppConversationColumnPage] => {
      const source = data.columns?.[column];
      return [
        column,
        {
          items: (source?.items ?? []).map((item) => toConversationSummary(item, storeNames)),
          total: source?.total ?? 0,
          hasMore: source?.hasMore ?? false,
        },
      ];
    }),
  ) as WhatsAppConversationBoard;
}

/** Página de una sola columna del tablero («Ver más»). */
export async function getWhatsAppConversationColumnPage(
  query: WhatsAppConversationQuery,
  column: WhatsAppThreadColumn,
  page: number,
  pageSize: number,
  storeNames: StoreNames,
): Promise<WhatsAppConversationColumnPage> {
  assertWhatsAppContractAvailable("threads");
  const { data } = await axiosAuth.get<ListPageDto>(`${BASE}/threads`, {
    params: { ...toParams(query), column, page, pageSize },
  });
  return {
    items: data.items.map((item) => toConversationSummary(item, storeNames)),
    total: data.total,
    hasMore: data.page * data.pageSize < data.total,
  };
}

export async function getWhatsAppConversationList(
  query: WhatsAppConversationQuery,
  page: number,
  pageSize: number,
  storeNames: StoreNames,
): Promise<WhatsAppConversationListPage> {
  assertWhatsAppContractAvailable("threads");
  const { data } = await axiosAuth.get<ListPageDto>(`${BASE}/threads`, {
    params: { ...toParams(query), view: "list", page, pageSize },
  });
  return {
    items: data.items.map((item) => toConversationSummary(item, storeNames)),
    page: data.page,
    pageSize: data.pageSize,
    total: data.total,
    hasMore: data.page * data.pageSize < data.total,
  };
}

// ───────── C-22.2 detalle y C-22.7 por pedido ─────────

export async function getWhatsAppConversation(
  id: string,
  storeNames: StoreNames,
): Promise<WhatsAppConversationDetail> {
  assertWhatsAppContractAvailable("threads");
  const { data } = await axiosAuth.get<ThreadDetailDto>(
    `${BASE}/threads/${encodeURIComponent(id)}`,
  );
  return toConversationDetail(data, storeNames);
}

/**
 * C-22.7 — Conversación de un pedido. El backend devuelve el hilo con mensajes o 404
 * cuando el pedido aún no tiene avisos; 404 se muestra como lista vacía.
 */
export async function getWhatsAppConversationsByOrder(
  orderId: string,
  storeNames: StoreNames,
): Promise<WhatsAppConversationDetail[]> {
  assertWhatsAppContractAvailable("threads");
  try {
    const { data } = await axiosAuth.get<ThreadDetailDto | ThreadDetailDto[]>(
      `${BASE}/threads/by-order/${encodeURIComponent(orderId)}`,
    );
    const items = Array.isArray(data) ? data : data ? [data] : [];
    return items.map((item) => toConversationDetail(item, storeNames));
  } catch (error) {
    if (isAxiosError(error) && error.response?.status === 404) return [];
    throw toWhatsAppApiError(error, "No se pudieron cargar los mensajes de WhatsApp.");
  }
}

// ───────── C-22.3..C-22.8 acciones (devuelven el hilo actualizado) ─────────

type ThreadAction = Promise<WhatsAppConversationDetail>;

export function replyWhatsAppConversation(id: string, text: string, storeNames: StoreNames): ThreadAction {
  assertWhatsAppContractAvailable("threads");
  return run("No se pudo enviar el mensaje.", async () => {
    const { data } = await axiosAuth.post<ThreadDetailDto>(
      `${BASE}/threads/${encodeURIComponent(id)}/reply`,
      { text },
      { headers: { "Idempotency-Key": newIdempotencyKey() } },
    );
    return toConversationDetail(data, storeNames);
  });
}

export function sendWhatsAppConversationTemplate(
  id: string,
  templateId: string,
  storeNames: StoreNames,
): ThreadAction {
  assertWhatsAppContractAvailable("threads");
  return run("No se pudo enviar la plantilla.", async () => {
    const { data } = await axiosAuth.post<ThreadDetailDto>(
      `${BASE}/threads/${encodeURIComponent(id)}/template`,
      { templateId },
      { headers: { "Idempotency-Key": newIdempotencyKey() } },
    );
    return toConversationDetail(data, storeNames);
  });
}

export function addWhatsAppConversationNote(id: string, text: string, storeNames: StoreNames): ThreadAction {
  assertWhatsAppContractAvailable("threads");
  return run("No se pudo guardar la nota.", async () => {
    const { data } = await axiosAuth.post<ThreadDetailDto>(
      `${BASE}/threads/${encodeURIComponent(id)}/notes`,
      { text },
    );
    return toConversationDetail(data, storeNames);
  });
}

export function assignWhatsAppConversation(
  id: string,
  assignee: { id: string; name: string },
  version: number,
  storeNames: StoreNames,
): ThreadAction {
  assertWhatsAppContractAvailable("threads");
  return run("No se pudo reasignar la conversación.", async () => {
    const { data } = await axiosAuth.post<ThreadDetailDto>(
      `${BASE}/threads/${encodeURIComponent(id)}/assign`,
      { assigneeId: assignee.id, assigneeName: assignee.name },
      { headers: { "If-Match": String(version) } },
    );
    return toConversationDetail(data, storeNames);
  });
}

export function markWhatsAppConversationAttended(
  id: string,
  version: number,
  storeNames: StoreNames,
): ThreadAction {
  assertWhatsAppContractAvailable("threads");
  return run("No se pudo marcar como atendida.", async () => {
    const { data } = await axiosAuth.post<ThreadDetailDto>(
      `${BASE}/threads/${encodeURIComponent(id)}/attend`,
      {},
      { headers: { "If-Match": String(version) } },
    );
    return toConversationDetail(data, storeNames);
  });
}

export function retryWhatsAppConversationMessage(messageId: string, storeNames: StoreNames): ThreadAction {
  assertWhatsAppContractAvailable("threads");
  return run("No se pudo reintentar el aviso.", async () => {
    const { data } = await axiosAuth.post<ThreadDetailDto>(
      `${BASE}/messages/${encodeURIComponent(messageId)}/retry`,
      {},
      { headers: { "Idempotency-Key": newIdempotencyKey() } },
    );
    return toConversationDetail(data, storeNames);
  });
}

// ───────── C-23 respuestas rápidas ─────────

interface QuickReplyDto {
  id: string;
  label: string;
  text: string;
  internalNote: boolean | null;
  requires: "trackingUrl" | null;
}

/** Sin `threadId` el texto conserva {{cliente}} y {{link_rastreo}}; el compositor los completa. */
export async function listWhatsAppQuickReplies(storeId: string | null): Promise<WhatsAppQuickReply[]> {
  assertWhatsAppContractAvailable("quickReplies");
  const { data } = await axiosAuth.get<QuickReplyDto[]>(`${BASE}/quick-replies`, {
    params: { storeId: storeId ?? undefined },
  });
  return (data ?? [])
    .filter((item) => !item.internalNote)
    .map((item) => ({ id: item.id, label: item.label, text: item.text, requires: item.requires }));
}
