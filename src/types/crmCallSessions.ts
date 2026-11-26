import type { Call, CallResult } from "@/types/crmCalls";

export type CallSessionStatus = "ringing" | "active" | "ended" | "missed" | "rejected" | "failed";
export type CallSessionDirection = "in" | "out";

/** Llamada real de WhatsApp (Calling API de Meta). */
export interface CallSession {
  id: string;
  conversationId: string | null;
  contactName: string | null;
  contactPhone: string | null;
  direction: CallSessionDirection;
  status: CallSessionStatus;
  agentUserId: string | null;
  agentUserName: string | null;
  /** true cuando WhatsApp Calling está apagado y todo es simulado. */
  simulated: boolean;
  answeredAt: string | null;
  endedAt: string | null;
  durationSeconds: number | null;
  endReason: string | null;
  hasResult: boolean;
  createdAt: string;
  /** Oferta del cliente (solo entrante sonando). */
  sdpOffer?: string | null;
  /** Respuesta del cliente (solo saliente en curso). */
  sdpAnswer?: string | null;
}

export interface CallSessionsLive {
  live: CallSession[];
  pendingResult: CallSession[];
}

export interface CallSessionsConfig {
  enabled: boolean;
  recording: boolean;
  /** La IA escucha y sugiere en vivo (Canales y tiendas). */
  liveAi?: boolean;
  /** Horario para llamar en hora de Lima; `open` = se puede llamar ahora. */
  hours?: { start: string; end: string; open: boolean };
}

export type LiveSpeaker = "agent" | "customer";

export interface LiveLine {
  who: LiveSpeaker;
  text: string;
  at: string;
  objection?: string | null;
  objectionResponse?: string | null;
}

/** IA en vivo de una llamada: transcripción, pasos del guion y sugerencia. */
export interface CallLiveAiState {
  callId: string;
  /** `mock` = sin llave de transcripción (llamada de ejemplo). */
  mode: "real" | "mock";
  lines: LiveLine[];
  /** Pasos del guion (1..n) ya cumplidos. */
  checks: number[];
  steps: string[];
  tip: string;
  objection: string | null;
  /** Resumen para editar al colgar. */
  summary: string;
  /** Modo de prueba: ya no quedan frases de ejemplo. */
  done: boolean;
}

export type CallSessionDays = 1 | 7 | 30;

export interface CallSessionStats {
  days: number;
  total: number;
  incoming: number;
  outgoing: number;
  answered: number;
  missed: number;
  ringingNow: number;
  activeNow: number;
  avgSeconds: number;
  totalMinutes: number;
  /** Minutos que Meta cobra: llamadas reales hechas por el equipo. */
  metaMinutes?: number;
  pendingResult: number;
}

export interface CallPermissionState {
  status: string;
  expiresAt: string | null;
  canCall: boolean;
  canRequest: boolean;
  simulated: boolean;
  sent?: boolean;
  /** Texto del pedido de permiso que recibe el cliente. */
  message?: string;
}

export interface CallSessionResultInput {
  result: CallResult;
  notes?: string;
  callbackAt?: string;
}

export interface CallSessionResultResponse {
  session: CallSession;
  call: Call;
}
