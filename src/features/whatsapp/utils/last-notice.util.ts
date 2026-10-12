import { WHATSAPP_MESSAGE_STATUSES, type WhatsAppMessageStatus } from "../enums/whatsapp.enums";
import { formatLimaDateTime } from "./lima-time.util";
import { MESSAGE_STATUS_PRESENTATION } from "./message-status.util";

export interface WhatsAppLastNotice {
  status: WhatsAppMessageStatus;
  templateName: string | null;
  at: Date;
  reason: string | null;
}

const STATUSES = new Set<string>(Object.values(WHATSAPP_MESSAGE_STATUSES));

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

export function parseWhatsAppLastNotice(raw: unknown): WhatsAppLastNotice | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  const status = readString(record.status);
  const at = readString(record.at);
  if (!status || !STATUSES.has(status) || !at) return null;
  const date = new Date(at);
  if (Number.isNaN(date.getTime())) return null;
  return {
    status: status as WhatsAppMessageStatus,
    templateName: readString(record.templateName),
    at: date,
    reason: readString(record.reason),
  };
}

export function describeLastNotice(notice: WhatsAppLastNotice): string {
  const { label } = MESSAGE_STATUS_PRESENTATION[notice.status];
  return [
    `Último aviso${notice.templateName ? ` ${notice.templateName}` : ""}: ${label}`,
    formatLimaDateTime(notice.at),
    notice.reason,
  ]
    .filter(Boolean)
    .join(" · ");
}
