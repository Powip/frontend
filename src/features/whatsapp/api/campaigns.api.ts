import { API } from "@/lib/api";
import axiosAuth from "@/lib/axiosAuth";
import { assertWhatsAppContractAvailable } from "../constants/whatsapp-contracts";
import {
  WHATSAPP_CAMPAIGN_DESTINATIONS,
  WHATSAPP_CAMPAIGN_SCHEDULE_TYPES,
  WHATSAPP_CAMPAIGN_STATUSES,
  WHATSAPP_NOTIFICATION_EVENTS,
  type WhatsAppCampaignDestination,
  type WhatsAppCampaignRecurrence,
  type WhatsAppCampaignStatus,
  type WhatsAppNotificationEvent,
} from "../enums/whatsapp.enums";
import type { WhatsAppCampaign, WhatsAppSegmentCount } from "../models/campaign.model";
import type { WhatsAppRulePreview } from "../models/rule.model";
import { CAMPAIGN_ALL_COURIERS, type CampaignValues } from "../schemas/campaign.schema";
import { toWhatsAppApiError } from "./threads.api";

const BASE = `${API.integrations}/wa`;

// ───────── DTO de C-21 (ms-integrations · wa-hub.campaigns.service toView) ─────────

interface CampaignDto {
  id: string;
  storeId: string;
  name: string;
  templateId: string;
  templateName: string | null;
  segment: {
    stage: string | null;
    courierId: string | null;
    storeId: string;
    destination: string;
  };
  segmentLabel: string | null;
  schedule: {
    type: string;
    date: string | null;
    recurrence: string | null;
    time: string;
  };
  status: string;
  pausedReason: "manual" | "quality_red" | null;
  matchingToday: number | null;
  results: {
    sent: number;
    delivered: number | null;
    read: number | null;
    clicked: number | null;
    notSent: number | null;
  } | null;
  version: number;
}

const EVENTS = new Set<string>(Object.values(WHATSAPP_NOTIFICATION_EVENTS));
const DESTINATIONS = new Set<string>(Object.values(WHATSAPP_CAMPAIGN_DESTINATIONS));
const STATUSES = new Set<string>(Object.values(WHATSAPP_CAMPAIGN_STATUSES));

export function toWhatsAppCampaign(dto: CampaignDto): WhatsAppCampaign {
  return {
    id: dto.id,
    name: dto.name,
    templateId: dto.templateId,
    templateName: dto.templateName ?? "Plantilla",
    segment: {
      stage:
        dto.segment.stage && EVENTS.has(dto.segment.stage)
          ? (dto.segment.stage as WhatsAppNotificationEvent)
          : WHATSAPP_NOTIFICATION_EVENTS.IN_TRANSIT,
      courierId: dto.segment.courierId,
      storeId: dto.segment.storeId ?? dto.storeId,
      destination: DESTINATIONS.has(dto.segment.destination)
        ? (dto.segment.destination as WhatsAppCampaignDestination)
        : WHATSAPP_CAMPAIGN_DESTINATIONS.ALL,
    },
    // El segmento se describe en pantalla con los nombres de tienda y courier del catálogo.
    segmentLabel: null,
    schedule: {
      type:
        dto.schedule.type === WHATSAPP_CAMPAIGN_SCHEDULE_TYPES.RECURRING
          ? WHATSAPP_CAMPAIGN_SCHEDULE_TYPES.RECURRING
          : WHATSAPP_CAMPAIGN_SCHEDULE_TYPES.ONCE,
      date: dto.schedule.date,
      recurrence: (dto.schedule.recurrence as WhatsAppCampaignRecurrence | null) ?? null,
      time: dto.schedule.time,
    },
    status: STATUSES.has(dto.status)
      ? (dto.status as WhatsAppCampaignStatus)
      : WHATSAPP_CAMPAIGN_STATUSES.SCHEDULED,
    pausedReason: dto.pausedReason,
    matchingToday: dto.matchingToday,
    results: dto.results,
    version: dto.version,
  };
}

function segmentBody(values: Pick<CampaignValues, "stage" | "courierId" | "storeId" | "destination">) {
  return {
    stage: values.stage,
    courierId: values.courierId === CAMPAIGN_ALL_COURIERS ? null : values.courierId,
    storeId: values.storeId,
    destination: values.destination,
  };
}

export function toCampaignBody(values: CampaignValues) {
  const recurring = values.scheduleType === WHATSAPP_CAMPAIGN_SCHEDULE_TYPES.RECURRING;
  return {
    storeId: values.storeId,
    name: values.name.trim(),
    templateId: values.templateId,
    segment: segmentBody(values),
    schedule: {
      type: values.scheduleType,
      date: recurring ? null : values.date,
      recurrence: recurring ? values.recurrence || null : null,
      time: values.time,
      timezone: "America/Lima",
    },
  };
}

const newIdempotencyKey = (): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

async function run<T>(fallback: string, request: () => Promise<T>): Promise<T> {
  try {
    return await request();
  } catch (error) {
    throw toWhatsAppApiError(error, fallback);
  }
}

/** C-21.1: envíos programados de la tienda activa. */
export async function listWhatsAppCampaigns(storeId: string | null): Promise<WhatsAppCampaign[]> {
  assertWhatsAppContractAvailable("campaigns");
  const { data } = await axiosAuth.get<{ items: CampaignDto[] }>(`${BASE}/campaigns`, {
    params: { storeId: storeId ?? undefined },
  });
  return (data?.items ?? []).map(toWhatsAppCampaign);
}

export function createWhatsAppCampaign(values: CampaignValues): Promise<WhatsAppCampaign> {
  assertWhatsAppContractAvailable("campaigns");
  return run("No se pudo programar el envío.", async () => {
    const { data } = await axiosAuth.post<CampaignDto>(`${BASE}/campaigns`, toCampaignBody(values), {
      headers: { "Idempotency-Key": newIdempotencyKey() },
    });
    return toWhatsAppCampaign(data);
  });
}

export function updateWhatsAppCampaign(
  id: string,
  version: number,
  values: CampaignValues,
): Promise<WhatsAppCampaign> {
  assertWhatsAppContractAvailable("campaigns");
  return run("No se pudieron guardar los cambios del envío.", async () => {
    const { data } = await axiosAuth.put<CampaignDto>(
      `${BASE}/campaigns/${encodeURIComponent(id)}`,
      toCampaignBody(values),
      { headers: { "If-Match": String(version) } },
    );
    return toWhatsAppCampaign(data);
  });
}

export function pauseWhatsAppCampaign(id: string): Promise<WhatsAppCampaign> {
  assertWhatsAppContractAvailable("campaigns");
  return run("No se pudo pausar el envío.", async () => {
    const { data } = await axiosAuth.post<CampaignDto>(`${BASE}/campaigns/${encodeURIComponent(id)}/pause`, {});
    return toWhatsAppCampaign(data);
  });
}

export function resumeWhatsAppCampaign(id: string): Promise<WhatsAppCampaign> {
  assertWhatsAppContractAvailable("campaigns");
  return run("No se pudo reanudar el envío.", async () => {
    const { data } = await axiosAuth.post<CampaignDto>(`${BASE}/campaigns/${encodeURIComponent(id)}/resume`, {});
    return toWhatsAppCampaign(data);
  });
}

/** C-21.2: pedidos que hoy cumplen el segmento (informativo; se recalcula al enviar). */
export async function countWhatsAppCampaignSegment(
  values: Pick<CampaignValues, "stage" | "courierId" | "storeId" | "destination">,
): Promise<WhatsAppSegmentCount> {
  assertWhatsAppContractAvailable("campaigns");
  const { data } = await axiosAuth.post<{ matchingToday: number; computedAt: string }>(
    `${BASE}/campaigns/segment-count`,
    { storeId: values.storeId, segment: segmentBody(values) },
  );
  return { matchingToday: data.matchingToday, computedAt: new Date(data.computedAt) };
}

/** C-16: alcance de una regla antes de activarla (activar vuelve a validar). */
export async function previewWhatsAppRule(
  rule: { id: string; key: string },
  storeId: string | null,
  orderStateLabel: string | null,
): Promise<WhatsAppRulePreview> {
  assertWhatsAppContractAvailable("rules");
  const { data } = await axiosAuth.post<{ matchingToday: number; computedAt: string }>(
    `${BASE}/rules/${encodeURIComponent(rule.id || rule.key)}/preview`,
    { ruleKey: rule.key, storeId: storeId ?? undefined },
  );
  return {
    matchingOrders: data.matchingToday,
    orderStateLabel,
    // El costo por mensaje depende del país del cliente; sin tarifa confirmada no se estima.
    estimatedCost: null,
    computedAt: new Date(data.computedAt),
  };
}
