import type { ReferralOrigin } from "./referral-origin.enum";

export type QueueItemKind = "conflicto" | "fraude" | "revision" | "sin_conflicto";

export type QueueItemResolution =
  | "pendiente"
  | "aprobado"
  | "rechazado"
  | "bloqueado"
  | "asignado"
  | "verificado";

export interface ReviewQueueItem {
  id: string;
  businessName: string;
  partnerName: string;
  origin: ReferralOrigin;
  contact: string;
  kind: QueueItemKind;
  explanation: string;
  note: string | null;
  resolution: QueueItemResolution;
}
