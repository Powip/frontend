import axiosAuth from "@/lib/axiosAuth";
import { API } from "@/lib/api";
import type {
  Call,
  CallDays,
  CallListParams,
  CallStats,
  CreateCallInput,
} from "@/types/crmCalls";

const BASE = `${API.crm}/crm/calls`;

/** Más recientes primero, máximo 200. */
export async function listCalls(params: CallListParams): Promise<Call[]> {
  return (
    await axiosAuth.get<{ items: Call[] }>(BASE, {
      params: {
        days: params.days,
        mine: params.mine,
        ...(params.conversationId ? { conversationId: params.conversationId } : {}),
      },
    })
  ).data.items;
}

export async function createCall(input: CreateCallInput): Promise<Call> {
  return (await axiosAuth.post<Call>(BASE, input)).data;
}

/** 403 si no la registró quien intenta borrarla ni es administrador. */
export async function deleteCall(id: string): Promise<void> {
  await axiosAuth.delete(`${BASE}/${encodeURIComponent(id)}`);
}

export async function getCallStats(days: CallDays): Promise<CallStats> {
  return (await axiosAuth.get<CallStats>(`${BASE}/stats`, { params: { days } })).data;
}
