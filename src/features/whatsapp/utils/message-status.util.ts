import {
  WHATSAPP_MESSAGE_STATUSES,
  WHATSAPP_THREAD_COLUMNS,
  type WhatsAppMessageStatus,
  type WhatsAppThreadColumn,
} from "../enums/whatsapp.enums";

const { QUEUED, SENT, DELIVERED, READ, FAILED, SKIPPED, ASSISTED } = WHATSAPP_MESSAGE_STATUSES;

export interface MessageStatusPresentation {
  label: string;
  detail: string | null;
}

export const MESSAGE_STATUS_PRESENTATION: Record<WhatsAppMessageStatus, MessageStatusPresentation> =
  {
    [QUEUED]: { label: "En cola", detail: null },
    [SENT]: { label: "Enviado", detail: null },
    [DELIVERED]: { label: "Entregado", detail: null },
    [READ]: { label: "Leído", detail: null },
    [FAILED]: { label: "No enviado", detail: "Meta no pudo entregarlo" },
    [SKIPPED]: { label: "No enviado", detail: "POWIP no lo envió" },
    [ASSISTED]: { label: "Asistido", detail: "Enviado a mano · sin confirmación de entrega" },
  };

export const THREAD_COLUMN_LABELS: Record<WhatsAppThreadColumn, string> = {
  [WHATSAPP_THREAD_COLUMNS.SENT]: "Enviado",
  [WHATSAPP_THREAD_COLUMNS.DELIVERED]: "Entregado",
  [WHATSAPP_THREAD_COLUMNS.READ]: "Leído",
  [WHATSAPP_THREAD_COLUMNS.REPLIED]: "Respondió",
  [WHATSAPP_THREAD_COLUMNS.FAILED]: "No enviado",
};

const META_STATUS_RANK: Partial<Record<WhatsAppMessageStatus, number>> = {
  [SENT]: 1,
  [DELIVERED]: 2,
  [READ]: 3,
};

export function getMessageStatusAccessibleLabel(status: WhatsAppMessageStatus): string {
  const { label, detail } = MESSAGE_STATUS_PRESENTATION[status];
  return detail ? `${label}: ${detail}` : label;
}

export function isMetaTrackedStatus(status: WhatsAppMessageStatus): boolean {
  return META_STATUS_RANK[status] !== undefined;
}

export function getMetaStatusRank(status: WhatsAppMessageStatus): number | null {
  return META_STATUS_RANK[status] ?? null;
}

export function hasDeliveryConfirmation(status: WhatsAppMessageStatus): boolean {
  return status === DELIVERED || status === READ;
}

export function hasReadConfirmation(status: WhatsAppMessageStatus): boolean {
  return status === READ;
}

export function isNotSentStatus(status: WhatsAppMessageStatus): boolean {
  return status === FAILED || status === SKIPPED;
}
