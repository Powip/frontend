import axiosAuth from "@/lib/axiosAuth";
import { API } from "@/lib/api";
import type {
  CallLiveAiState,
  CallPermissionState,
  CallSession,
  CallSessionDays,
  CallSessionResultInput,
  CallSessionResultResponse,
  CallSessionStats,
  CallSessionsConfig,
  CallSessionsLive,
  LiveSpeaker,
} from "@/types/crmCallSessions";

/**
 * Llamadas reales de WhatsApp. NEXT_PUBLIC_API_CRM_CALLS permite apuntar solo
 * las llamadas a otro ms-crm (pruebas locales); por defecto usa API.crm.
 */
const BASE = `${process.env.NEXT_PUBLIC_API_CRM_CALLS || API.crm}/crm/call-sessions`;
const id = (v: string) => encodeURIComponent(v);

export async function getLiveCalls(): Promise<CallSessionsLive> {
  return (await axiosAuth.get<CallSessionsLive>(`${BASE}/live`)).data;
}

export async function getCallsConfig(): Promise<CallSessionsConfig> {
  return (await axiosAuth.get<CallSessionsConfig>(`${BASE}/config`)).data;
}

export async function getCallSessionStats(days: CallSessionDays): Promise<CallSessionStats> {
  return (await axiosAuth.get<CallSessionStats>(`${BASE}/stats`, { params: { days } })).data;
}

export async function listCallSessions(days: CallSessionDays): Promise<CallSession[]> {
  return (await axiosAuth.get<{ items: CallSession[] }>(BASE, { params: { days } })).data.items;
}

export async function getCallPermission(conversationId: string): Promise<CallPermissionState> {
  return (
    await axiosAuth.get<CallPermissionState>(`${BASE}/permission`, { params: { conversationId } })
  ).data;
}

export async function requestCallPermission(conversationId: string): Promise<CallPermissionState> {
  return (await axiosAuth.post<CallPermissionState>(`${BASE}/permission-request`, { conversationId }))
    .data;
}

/** 400 CALL_PERMISSION_REQUIRED si el cliente no dio permiso; 409 si ya tienes una llamada. */
export async function startCall(conversationId: string, sdp: string): Promise<CallSession> {
  return (await axiosAuth.post<CallSession>(`${BASE}/start`, { conversationId, sdp })).data;
}

/** 409 si ya no suena o la contestó otra persona. */
export async function acceptCall(callId: string, sdp: string): Promise<CallSession> {
  return (await axiosAuth.post<CallSession>(`${BASE}/${id(callId)}/accept`, { sdp })).data;
}

export async function rejectCall(callId: string): Promise<CallSession> {
  return (await axiosAuth.post<CallSession>(`${BASE}/${id(callId)}/reject`, {})).data;
}

export async function hangupCall(callId: string): Promise<CallSession> {
  return (await axiosAuth.post<CallSession>(`${BASE}/${id(callId)}/hangup`, {})).data;
}

export async function saveCallSessionResult(
  callId: string,
  input: CallSessionResultInput,
): Promise<CallSessionResultResponse> {
  return (await axiosAuth.post<CallSessionResultResponse>(`${BASE}/${id(callId)}/result`, input)).data;
}

export async function getCallLiveAi(callId: string): Promise<CallLiveAiState> {
  return (await axiosAuth.get<CallLiveAiState>(`${BASE}/${id(callId)}/live-ai`)).data;
}

/**
 * IA en vivo: manda un trozo de audio (micrófono o cliente) y recibe la
 * sugerencia. Sin audio, en el modo de prueba agrega la siguiente frase.
 * 400 LIVE_AI_OFF si está apagada en Canales y tiendas.
 */
export async function sendCallLiveAi(
  callId: string,
  chunk?: { audio: Blob; speaker: LiveSpeaker },
): Promise<CallLiveAiState> {
  const form = new FormData();
  if (chunk) {
    form.append("speaker", chunk.speaker);
    form.append("audio", chunk.audio, `trozo.${chunk.audio.type.includes("ogg") ? "ogg" : "webm"}`);
  }
  return (await axiosAuth.post<CallLiveAiState>(`${BASE}/${id(callId)}/live-ai`, form)).data;
}
