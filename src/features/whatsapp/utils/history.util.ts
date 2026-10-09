import {
  WHATSAPP_HISTORY_PERIODS,
  WHATSAPP_MESSAGE_STATUSES,
  type WhatsAppHistoryPeriod,
} from "../enums/whatsapp.enums";
import type {
  WhatsAppHistoryFilters,
  WhatsAppHistoryMessage,
  WhatsAppHistoryMetrics,
  WhatsAppHistoryQuery,
  WhatsAppLimaRange,
} from "../models/history.model";
import { normalizeConversationSearch } from "./conversation-filters.util";
import { getLimaDateParts, toLimaDateKey } from "./lima-time.util";

const MINUTE_MS = 60 * 1000;

function limaOffsetMs(now: Date): number {
  const { year, month, day, hour, minute } = getLimaDateParts(now);
  const limaWallClockAsUtc = Date.UTC(year, month - 1, day, hour, minute);
  const nowToMinute = Math.floor(now.getTime() / MINUTE_MS) * MINUTE_MS;
  return limaWallClockAsUtc - nowToMinute;
}

function limaMidnight(year: number, month: number, day: number, offsetMs: number): Date {
  return new Date(Date.UTC(year, month - 1, day) - offsetMs);
}

export function getLimaPeriodRange(period: WhatsAppHistoryPeriod, now: Date): WhatsAppLimaRange {
  const { year, month, day } = getLimaDateParts(now);
  const offsetMs = limaOffsetMs(now);
  const startDay =
    period === WHATSAPP_HISTORY_PERIODS.TODAY
      ? day
      : period === WHATSAPP_HISTORY_PERIODS.LAST_7_DAYS
        ? day - 6
        : 1;
  const from = limaMidnight(year, month, startDay, offsetMs);
  return { from, to: now, fromKey: toLimaDateKey(from), toKey: toLimaDateKey(now) };
}

export function toHistoryQuery(filters: WhatsAppHistoryFilters, now: Date): WhatsAppHistoryQuery {
  const range = getLimaPeriodRange(filters.period, now);
  return {
    period: filters.period,
    from: range.from.toISOString(),
    to: range.to.toISOString(),
    storeId: filters.storeId,
    q: normalizeConversationSearch(filters.search),
  };
}

export type Ratio =
  | { kind: "unknown" }
  | { kind: "no-base" }
  | { kind: "value"; percent: number; label: string };

export function computeRatio(numerator: number | null, denominator: number | null): Ratio {
  if (numerator === null || denominator === null) return { kind: "unknown" };
  if (denominator === 0) return { kind: "no-base" };
  const percent = (numerator / denominator) * 100;
  return {
    kind: "value",
    percent,
    label: `${percent.toLocaleString("es-PE", { maximumFractionDigits: 1 })}%`,
  };
}

export function formatCount(value: number | null): string {
  return value === null ? "Sin dato" : value.toLocaleString("es-PE");
}

export function describeRatio(ratio: Ratio, base: string, emptyBase: string): string {
  switch (ratio.kind) {
    case "unknown":
      return "Porcentaje sin dato";
    case "no-base":
      return emptyBase;
    case "value":
      return `${ratio.label} de ${base}`;
  }
}

export interface FunnelStep {
  key: "sent" | "delivered" | "read" | "trackingOpened";
  label: string;
  count: number | null;
  ratio: Ratio;
}

export function buildFunnel(metrics: WhatsAppHistoryMetrics): FunnelStep[] {
  const steps: { key: FunnelStep["key"]; label: string; count: number | null }[] = [
    { key: "sent", label: "Enviados", count: metrics.sent },
    { key: "delivered", label: "Entregados", count: metrics.delivered },
    { key: "read", label: "Leídos", count: metrics.read },
    { key: "trackingOpened", label: "Abrieron el rastreo", count: metrics.trackingOpened },
  ];
  return steps.map((step) => ({ ...step, ratio: computeRatio(step.count, metrics.sent) }));
}

export interface TimelineStep {
  key: string;
  label: string;
  at: Date | null;
  tone: "done" | "pending" | "failed" | "info";
}

export function buildTimelineSteps(message: WhatsAppHistoryMessage): TimelineStep[] {
  const { timeline } = message;
  if (message.status === WHATSAPP_MESSAGE_STATUSES.ASSISTED) {
    return [
      {
        key: "assisted",
        label: message.assistedBy
          ? `Marcado como enviado por ${message.assistedBy.name}`
          : "Marcado como enviado a mano",
        at: timeline.sentAt,
        tone: "info",
      },
      {
        key: "assisted-note",
        label: "Sin confirmación de entrega ni de lectura",
        at: null,
        tone: "pending",
      },
    ];
  }
  if (
    message.status === WHATSAPP_MESSAGE_STATUSES.FAILED ||
    message.status === WHATSAPP_MESSAGE_STATUSES.SKIPPED
  ) {
    return [
      ...(timeline.queuedAt
        ? [{ key: "queued", label: "En cola", at: timeline.queuedAt, tone: "done" as const }]
        : []),
      {
        key: "failed",
        label:
          message.status === WHATSAPP_MESSAGE_STATUSES.SKIPPED
            ? "POWIP no lo envió"
            : "Meta no pudo entregarlo",
        at: timeline.failedAt,
        tone: "failed",
      },
    ];
  }
  const steps: TimelineStep[] = [
    {
      key: "sent",
      label: "Enviado",
      at: timeline.sentAt,
      tone: timeline.sentAt ? "done" : "pending",
    },
    {
      key: "delivered",
      label: "Entregado",
      at: timeline.deliveredAt,
      tone: timeline.deliveredAt ? "done" : "pending",
    },
    {
      key: "read",
      label: "Leído",
      at: timeline.readAt,
      tone: timeline.readAt ? "done" : "pending",
    },
  ];
  if (timeline.clickedAt) {
    steps.push({ key: "clicked", label: "Abrió el rastreo", at: timeline.clickedAt, tone: "info" });
  }
  return steps;
}
