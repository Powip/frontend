import {
  WHATSAPP_MESSAGE_STATUSES,
  WHATSAPP_THREAD_COLUMNS,
  type WhatsAppThreadColumn,
} from "../enums/whatsapp.enums";
import type {
  WhatsAppConversationBoard,
  WhatsAppConversationSummary,
} from "../models/conversation.model";

const { QUEUED, SENT, DELIVERED, READ, FAILED, SKIPPED, ASSISTED } = WHATSAPP_MESSAGE_STATUSES;

const COLUMN_BY_OUTBOUND_STATUS = {
  [QUEUED]: WHATSAPP_THREAD_COLUMNS.SENT,
  [SENT]: WHATSAPP_THREAD_COLUMNS.SENT,
  [ASSISTED]: WHATSAPP_THREAD_COLUMNS.SENT,
  [DELIVERED]: WHATSAPP_THREAD_COLUMNS.DELIVERED,
  [READ]: WHATSAPP_THREAD_COLUMNS.READ,
  [FAILED]: WHATSAPP_THREAD_COLUMNS.FAILED,
  [SKIPPED]: WHATSAPP_THREAD_COLUMNS.FAILED,
} as const satisfies Record<string, WhatsAppThreadColumn>;

export const CONVERSATION_COLUMN_ORDER: WhatsAppThreadColumn[] = [
  WHATSAPP_THREAD_COLUMNS.SENT,
  WHATSAPP_THREAD_COLUMNS.DELIVERED,
  WHATSAPP_THREAD_COLUMNS.READ,
  WHATSAPP_THREAD_COLUMNS.REPLIED,
  WHATSAPP_THREAD_COLUMNS.FAILED,
];

type ColumnInput = Pick<WhatsAppConversationSummary, "attention" | "lastOutbound">;

export function getConversationColumn(conversation: ColumnInput): WhatsAppThreadColumn | null {
  if (conversation.attention.pendingReply) return WHATSAPP_THREAD_COLUMNS.REPLIED;
  if (!conversation.lastOutbound) return null;
  return COLUMN_BY_OUTBOUND_STATUS[conversation.lastOutbound.status];
}

export function groupBoardByColumn(
  board: WhatsAppConversationBoard,
): Record<WhatsAppThreadColumn, WhatsAppConversationSummary[]> {
  const grouped = Object.fromEntries(
    CONVERSATION_COLUMN_ORDER.map((column) => [column, [] as WhatsAppConversationSummary[]]),
  ) as Record<WhatsAppThreadColumn, WhatsAppConversationSummary[]>;
  const seen = new Set<string>();
  for (const sourceColumn of CONVERSATION_COLUMN_ORDER) {
    for (const conversation of board[sourceColumn].items) {
      if (seen.has(conversation.id)) continue;
      seen.add(conversation.id);
      grouped[getConversationColumn(conversation) ?? sourceColumn].push(conversation);
    }
  }
  return grouped;
}

export function isShownAsAttended(conversation: Pick<WhatsAppConversationSummary, "attention">) {
  return conversation.attention.attended && !conversation.attention.pendingReply;
}

export function canMarkAttended(conversation: Pick<WhatsAppConversationSummary, "attention">) {
  return conversation.attention.pendingReply;
}

export function formatElapsed(from: Date, now: Date): string {
  const totalMinutes = Math.max(0, Math.floor((now.getTime() - from.getTime()) / 60000));
  if (totalMinutes < 1) return "menos de 1 min";
  if (totalMinutes < 60) return `${totalMinutes} min`;
  const totalHours = Math.floor(totalMinutes / 60);
  if (totalHours >= 24) {
    const days = Math.floor(totalHours / 24);
    return `${days} ${days === 1 ? "día" : "días"}`;
  }
  const minutes = totalMinutes % 60;
  return minutes === 0 ? `${totalHours} h` : `${totalHours} h ${minutes} min`;
}

export interface WaitingDescription {
  text: string;
  overdue: boolean;
}

export function describeWaiting(
  conversation: Pick<WhatsAppConversationSummary, "attention">,
  now: Date,
): WaitingDescription | null {
  const { pendingReply, waitingSince, overdue } = conversation.attention;
  if (!pendingReply || !waitingSince) return null;
  const elapsed = formatElapsed(waitingSince, now);
  if (overdue === true) return { text: `Sin atender hace ${elapsed}`, overdue: true };
  return { text: `Espera hace ${elapsed}`, overdue: false };
}

export function getInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return (
    words
      .slice(0, 2)
      .map((word) => word[0])
      .join("")
      .toUpperCase() || "?"
  );
}
