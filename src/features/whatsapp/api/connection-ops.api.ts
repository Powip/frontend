import { API } from "@/lib/api";
import axiosAuth from "@/lib/axiosAuth";
import { assertWhatsAppContractAvailable } from "../constants/whatsapp-contracts";
import {
  WHATSAPP_MESSAGE_STATUSES,
  type WhatsAppAssistedStatus,
  type WhatsAppMessageStatus,
} from "../enums/whatsapp.enums";
import type {
  WhatsAppAssistedItem,
  WhatsAppAssistedQueue,
  WhatsAppCoexistenceState,
  WhatsAppContingencySettings,
  WhatsAppContingencyTriggers,
  WhatsAppPricing,
  WhatsAppPricingItem,
  WhatsAppTestRun,
  WhatsAppUsageSummary,
} from "../models/connection.model";

const BASE = `${API.integrations}/wa`;

// ───────── Varios números por tienda ─────────

/** Vendedora del número. userId null lo devuelve a la tienda. */
export async function assignWhatsAppNumber(
  accountId: string,
  input: { userId: string | null; userName: string | null },
): Promise<void> {
  await axiosAuth.put(`${BASE}/accounts/${encodeURIComponent(accountId)}/assignment`, input);
}

/** «Solo app»: guarda un número que vive solo en el celular. */
export async function connectAppOnlyWhatsAppNumber(input: {
  storeId: string;
  phoneNumber: string;
  assignedUserId?: string;
  assignedUserName?: string;
  confirmReassign?: boolean;
}): Promise<{ id: string }> {
  const { data } = await axiosAuth.post<{ id: string }>(`${BASE}/accounts/app-only`, input);
  return data;
}

/** Número principal de la tienda: el que envía los avisos automáticos. */
export async function setPrimaryWhatsAppNumber(accountId: string): Promise<void> {
  await axiosAuth.post(`${BASE}/accounts/${encodeURIComponent(accountId)}/primary`, {});
}

/** Coexistencia de los números de la empresa (los que siguen en la app del celular). */
export async function listWhatsAppCoexistence(): Promise<WhatsAppCoexistenceState[]> {
  const { data } = await axiosAuth.get<{ items?: WhatsAppCoexistenceState[] }>(
    `${BASE}/accounts/coexistence`,
  );
  return data?.items ?? [];
}

/** Pide a Meta los contactos y el historial del celular (una sola vez, dentro de 24 h). */
export async function syncWhatsAppAppData(accountId: string): Promise<WhatsAppCoexistenceState> {
  try {
    const { data } = await axiosAuth.post<WhatsAppCoexistenceState>(
      `${BASE}/accounts/${encodeURIComponent(accountId)}/sync-app-data`,
      {},
    );
    return data;
  } catch (error) {
    const message = (error as { response?: { data?: { message?: unknown } } })?.response?.data
      ?.message;
    throw typeof message === "string" && message ? new Error(message) : error;
  }
}

const toDate = (value: string | null | undefined): Date | null => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const toText = (value: number | string | null | undefined): string | null =>
  value === null || value === undefined ? null : String(value);

const newIdempotencyKey = (): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

// ───────── C-07 mensaje de prueba ─────────

interface TestRunDto {
  messageId: string | null;
  phone: string;
  templateName: string;
  status: WhatsAppMessageStatus;
  startedAt: string;
  sentAt: string | null;
  deliveredAt: string | null;
  readAt: string | null;
  failedAt: string | null;
  errorMessage: string | null;
}

function toTestRun(dto: TestRunDto): WhatsAppTestRun {
  return {
    messageId: dto.messageId ?? "",
    phone: dto.phone,
    templateName: dto.templateName,
    status: dto.status ?? WHATSAPP_MESSAGE_STATUSES.SENT,
    startedAt: toDate(dto.startedAt) ?? new Date(),
    sentAt: toDate(dto.sentAt),
    deliveredAt: toDate(dto.deliveredAt),
    readAt: toDate(dto.readAt),
    failedAt: toDate(dto.failedAt),
    errorMessage: dto.errorMessage ?? null,
  };
}

// C-07 · POST /wa/accounts/:id/test (Idempotency-Key)
export async function sendWhatsAppAccountTest(
  accountId: string,
  input: { to: string; templateId: string; storeId: string },
): Promise<WhatsAppTestRun> {
  assertWhatsAppContractAvailable("testMessage");
  const { data } = await axiosAuth.post<TestRunDto>(
    `${BASE}/accounts/${encodeURIComponent(accountId)}/test`,
    input,
    { headers: { "Idempotency-Key": newIdempotencyKey() } },
  );
  return toTestRun(data);
}

// C-07 · GET /wa/messages/:messageId (estado de la prueba: enviado → entregado → leído)
export async function getWhatsAppTestRunStatus(messageId: string): Promise<WhatsAppTestRun> {
  assertWhatsAppContractAvailable("testMessage");
  const { data } = await axiosAuth.get<TestRunDto>(
    `${BASE}/messages/${encodeURIComponent(messageId)}`,
  );
  return toTestRun(data);
}

// ───────── C-08 / C-09 uso y tarifas ─────────

interface UsageDto {
  month: string;
  templatesDelivered: number | null;
  serviceRepliesUsed: number | null;
  serviceRepliesFree: number | null;
  estimatedCost: {
    usd: number | string;
    pen: number | string | null;
    exchangeRate: number | string | null;
    rateDate: string | null;
  } | null;
}

// C-08 · GET /wa/usage?storeId=&month=
export async function getWhatsAppUsage(
  storeId: string,
  month?: string,
): Promise<WhatsAppUsageSummary> {
  assertWhatsAppContractAvailable("usageAndPricing");
  const { data } = await axiosAuth.get<UsageDto>(`${BASE}/usage`, {
    params: { storeId, month: month ?? undefined },
  });
  return {
    month: data.month,
    templatesDelivered: data.templatesDelivered ?? null,
    serviceRepliesUsed: data.serviceRepliesUsed ?? null,
    serviceRepliesFree: data.serviceRepliesFree ?? null,
    estimatedCost: data.estimatedCost
      ? {
          usd: String(data.estimatedCost.usd),
          pen: toText(data.estimatedCost.pen),
          exchangeRate: toText(data.estimatedCost.exchangeRate),
          rateDate: data.estimatedCost.rateDate ?? null,
        }
      : null,
  };
}

interface PricingDto {
  market: string;
  currency: "USD";
  effectiveFrom: string;
  source: string;
  sourceUrl: string | null;
  verifiedAt: string | null;
  exchangeRate: { value: number | string; date: string | null; source: string } | null;
  items: {
    type: WhatsAppPricingItem["type"];
    label: string;
    chargedWhen: string;
    usd: number | string;
    pen: number | string | null;
  }[];
}

// C-09 · GET /wa/pricing
export async function getWhatsAppPricing(): Promise<WhatsAppPricing> {
  assertWhatsAppContractAvailable("usageAndPricing");
  const { data } = await axiosAuth.get<PricingDto>(`${BASE}/pricing`);
  return {
    market: data.market,
    currency: "USD",
    effectiveFrom: data.effectiveFrom,
    source: data.source,
    sourceUrl: data.sourceUrl ?? null,
    verifiedAt: toDate(data.verifiedAt),
    // Sin fecha del tipo de cambio no se muestra la línea: no se inventa una fecha.
    exchangeRate:
      data.exchangeRate && data.exchangeRate.date
        ? {
            value: String(data.exchangeRate.value),
            date: data.exchangeRate.date,
            source: data.exchangeRate.source,
          }
        : null,
    items: (data.items ?? []).map((item) => ({
      type: item.type,
      label: item.label,
      chargedWhen: item.chargedWhen,
      usd: String(item.usd),
      pen: toText(item.pen),
    })),
  };
}

// ───────── C-10 contingencia ─────────

interface ContingencyDto {
  enabled: boolean;
  backupAccount: WhatsAppContingencySettings["backupAccount"];
  triggers: WhatsAppContingencyTriggers;
  sender: { type: "all_agents" | "user"; userId: string | null };
  active: boolean | null;
  activatedAt: string | null;
  reason: string | null;
  version: number;
}

const toContingency = (dto: ContingencyDto): WhatsAppContingencySettings => ({
  ...dto,
  activatedAt: toDate(dto.activatedAt),
});

// C-10 · GET /wa/contingency?storeId=
export async function getWhatsAppContingency(
  storeId: string,
): Promise<WhatsAppContingencySettings> {
  assertWhatsAppContractAvailable("contingency");
  const { data } = await axiosAuth.get<ContingencyDto>(`${BASE}/contingency`, {
    params: { storeId },
  });
  return toContingency(data);
}

export interface WhatsAppContingencyBody {
  enabled: boolean;
  backupAccountId: string | null;
  triggers: WhatsAppContingencyTriggers;
  sender: { type: "all_agents" | "user"; userId: string | null };
}

// C-10 · PUT /wa/contingency?storeId= con If-Match
export async function updateWhatsAppContingency(
  storeId: string,
  version: number,
  body: WhatsAppContingencyBody,
): Promise<WhatsAppContingencySettings> {
  assertWhatsAppContractAvailable("contingency");
  const { data } = await axiosAuth.put<ContingencyDto>(`${BASE}/contingency`, body, {
    params: { storeId },
    headers: { "If-Match": String(version) },
  });
  return toContingency(data);
}

// C-10 · POST /wa/contingency/activate | deactivate
export async function setWhatsAppContingencyActive(
  storeId: string,
  active: boolean,
  reason?: string,
): Promise<WhatsAppContingencySettings> {
  assertWhatsAppContractAvailable("contingency");
  const { data } = await axiosAuth.post<ContingencyDto>(
    `${BASE}/contingency/${active ? "activate" : "deactivate"}`,
    active ? { reason: reason ?? "Activación manual" } : {},
    { params: { storeId } },
  );
  return toContingency(data);
}

// ───────── C-11 cola de envío asistido ─────────

interface AssistedItemDto {
  id: string;
  orderId: string | null;
  orderNumber: string | null;
  customerName: string | null;
  phone: string;
  templateName: string | null;
  courierName: string | null;
  waMeUrl: string | null;
  status: WhatsAppAssistedStatus;
  createdAt: string;
  openedBy: { id: string; name: string } | null;
}

const toAssistedItem = (dto: AssistedItemDto): WhatsAppAssistedItem => ({
  ...dto,
  createdAt: toDate(dto.createdAt) ?? new Date(0),
  openedBy: dto.openedBy as WhatsAppAssistedItem["openedBy"],
});

// C-11 · GET /wa/assisted-queue?storeId=
export async function listWhatsAppAssistedQueue(storeId: string): Promise<WhatsAppAssistedQueue> {
  assertWhatsAppContractAvailable("contingency");
  const { data } = await axiosAuth.get<{
    items: AssistedItemDto[];
    pendingTotal: number | null;
    hasMore: boolean;
  }>(`${BASE}/assisted-queue`, { params: { storeId } });
  return {
    items: (data.items ?? []).map(toAssistedItem),
    pendingTotal: data.pendingTotal ?? null,
    hasMore: Boolean(data.hasMore),
  };
}

// C-11 · POST /wa/assisted-queue/:id/opened | mark-sent | discard (D-72: mark-sent es el único camino a enviado)
export async function actOnWhatsAppAssistedItem(
  itemId: string,
  action: "opened" | "mark-sent" | "discard",
  reason?: string,
): Promise<WhatsAppAssistedItem> {
  assertWhatsAppContractAvailable("contingency");
  const { data } = await axiosAuth.post<AssistedItemDto>(
    `${BASE}/assisted-queue/${encodeURIComponent(itemId)}/${action}`,
    action === "discard" ? { reason: reason ?? "" } : {},
  );
  return toAssistedItem(data);
}
