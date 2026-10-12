import {
  CONNECTION_STATE_LABELS,
  getConnectionTypeDefinition,
  PRICING_STALE_AFTER_DAYS,
  TEST_MESSAGE_READ_WAIT_MS,
} from "../constants/whatsapp-connection-catalog";
import { WHATSAPP_CONNECTION_STATES, WHATSAPP_MESSAGE_STATUSES } from "../enums/whatsapp.enums";
import type {
  WhatsAppAccount,
  WhatsAppConnectionStatus,
  WhatsAppTestRun,
} from "../models/connection.model";
import type { WhatsAppResourceState } from "../models/resource-state.model";
import { formatElapsed } from "./conversation-state.util";

const DAY_MS = 24 * 60 * 60 * 1000;

export function describeConnectionStatus(status: WhatsAppConnectionStatus | null): string {
  if (!status || status.state === null) return "Estado sin confirmar";
  if (status.state === WHATSAPP_CONNECTION_STATES.CONNECTED && status.connectionType) {
    return getConnectionTypeDefinition(status.connectionType).statusLabel;
  }
  return CONNECTION_STATE_LABELS[status.state];
}

export interface UsageDescription {
  text: string;
  percent: number | null;
}

export function describeUsage(account: Pick<WhatsAppAccount, "usageToday">): UsageDescription {
  const usage = account.usageToday;
  if (!usage || usage.uniqueContacts === null) return { text: "Sin dato de uso", percent: null };
  const used = usage.uniqueContacts.toLocaleString("es-PE");
  if (usage.limit === null || usage.limit <= 0) {
    return { text: `${used} compradores hoy · límite sin dato`, percent: null };
  }
  return {
    text: `${used} de ${usage.limit.toLocaleString("es-PE")} compradores hoy`,
    percent: Math.min((usage.uniqueContacts / usage.limit) * 100, 100),
  };
}

export function describeLimitReset(resetsAt: Date | null, now: Date): string {
  if (!resetsAt) return "Meta no informó cuándo se reinicia";
  if (resetsAt.getTime() <= now.getTime()) return "Reinicio pendiente de confirmar por Meta";
  const minutes = Math.ceil((resetsAt.getTime() - now.getTime()) / 60000);
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours > 0 ? `Se reinicia en ${hours} h ${rest} min` : `Se reinicia en ${rest} min`;
}

export function describeWebhook(account: Pick<WhatsAppAccount, "webhook">, now: Date): string {
  const webhook = account.webhook;
  if (!webhook || webhook.state === null) return "Sin dato";
  const state = webhook.state === "active" ? "Activo" : "Inactivo";
  if (!webhook.lastEventAt) return `${state} · sin eventos registrados`;
  return `${state} · último evento hace ${formatElapsed(webhook.lastEventAt, now)}`;
}

export function formatMetaId(id: string | null): string {
  if (!id) return "Sin dato";
  return id.replace(/(\d{3})(?=\d)/g, "$1 ").trim();
}

export type StoreConnectionRow =
  | { kind: "unknown"; reason: "pending" | "loading" | "error" | "forbidden" }
  | { kind: "not-connected" }
  | { kind: "connected"; account: WhatsAppAccount };

export function resolveStoreConnection(
  storeId: string,
  accounts: WhatsAppResourceState<WhatsAppAccount[]>,
): StoreConnectionRow {
  switch (accounts.kind) {
    case "pending-integration":
      return { kind: "unknown", reason: "pending" };
    case "loading":
      return { kind: "unknown", reason: "loading" };
    case "error":
      return { kind: "unknown", reason: "error" };
    case "forbidden":
      return { kind: "unknown", reason: "forbidden" };
    case "ready": {
      const account = accounts.data.find(
        (item) => item.storeId === storeId && item.role === "principal",
      );
      return account ? { kind: "connected", account } : { kind: "not-connected" };
    }
  }
}

export type TestProgress =
  | { kind: "in-progress"; waitingFor: "sent" | "delivered" | "read" }
  | { kind: "failed"; message: string }
  | { kind: "read" }
  | { kind: "delivered-without-read" };

export function resolveTestProgress(run: WhatsAppTestRun, now: Date): TestProgress {
  if (run.status === WHATSAPP_MESSAGE_STATUSES.FAILED || run.failedAt) {
    return { kind: "failed", message: run.errorMessage ?? "Meta no pudo entregar la prueba." };
  }
  if (run.readAt || run.status === WHATSAPP_MESSAGE_STATUSES.READ) return { kind: "read" };
  if (run.deliveredAt || run.status === WHATSAPP_MESSAGE_STATUSES.DELIVERED) {
    const reference = run.deliveredAt ?? run.startedAt;
    return now.getTime() - reference.getTime() >= TEST_MESSAGE_READ_WAIT_MS
      ? { kind: "delivered-without-read" }
      : { kind: "in-progress", waitingFor: "read" };
  }
  if (run.sentAt || run.status === WHATSAPP_MESSAGE_STATUSES.SENT) {
    return { kind: "in-progress", waitingFor: "delivered" };
  }
  return { kind: "in-progress", waitingFor: "sent" };
}

export function isPricingStale(verifiedAt: Date | null, now: Date): boolean {
  if (!verifiedAt) return true;
  return now.getTime() - verifiedAt.getTime() > PRICING_STALE_AFTER_DAYS * DAY_MS;
}
