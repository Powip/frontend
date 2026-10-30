import type { WhatsAppReplyWindowInfo } from "../models/conversation.model";

export const REPLY_WINDOW_DURATION_MS = 24 * 60 * 60 * 1000;

export type ReplyWindowState = "open" | "closed" | "unknown";

export interface ReplyWindowStatus {
  state: ReplyWindowState;
  expiresAt: Date | null;
  remainingMs: number;
}

const UNKNOWN: ReplyWindowStatus = { state: "unknown", expiresAt: null, remainingMs: 0 };

function isValidDate(value: unknown): value is Date {
  return value instanceof Date && !Number.isNaN(value.getTime());
}

export function resolveReplyWindow(
  info: WhatsAppReplyWindowInfo | null | undefined,
  now: Date,
): ReplyWindowStatus {
  if (!info || info.open === null || info.open === undefined) return UNKNOWN;
  const expiresAt = isValidDate(info.expiresAt) ? info.expiresAt : null;
  if (info.open === false) return { state: "closed", expiresAt, remainingMs: 0 };
  if (!expiresAt) return UNKNOWN;
  const remainingMs = expiresAt.getTime() - now.getTime();
  if (remainingMs <= 0) return { state: "closed", expiresAt, remainingMs: 0 };
  return { state: "open", expiresAt, remainingMs };
}

export function formatReplyWindowRemaining(remainingMs: number): string {
  if (remainingMs <= 0) return "0 min";
  const totalMinutes = Math.floor(remainingMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${Math.max(minutes, 1)} min`;
  if (minutes === 0) return `${hours} h`;
  return `${hours} h ${minutes} min`;
}

export interface ReplyWindowDescription {
  title: string;
  detail: string;
}

export function describeReplyWindow(status: ReplyWindowStatus): ReplyWindowDescription {
  switch (status.state) {
    case "open":
      return {
        title: "Ventana abierta",
        detail: `Quedan ${formatReplyWindowRemaining(status.remainingMs)} para responder con texto libre`,
      };
    case "closed":
      return {
        title: "Ventana cerrada",
        detail: "Solo puedes enviar una plantilla aprobada",
      };
    case "unknown":
      return {
        title: "Ventana sin confirmar",
        detail: "POWIP todavía no confirmó si se puede responder con texto libre",
      };
  }
}
