import axiosAuth from "@/lib/axiosAuth";
import { API } from "@/lib/api";
import type { AuditD, ObjectionFamily, ObjectionStatsD, TeamBoard } from "@/types/crmBlockD";

const BASE = `${API.crm}/crm`;
const store = (storeId?: string) => (storeId ? { storeId } : {});

export async function getTeamBoard(storeId?: string): Promise<TeamBoard> {
  const { data } = await axiosAuth.get<TeamBoard>(`${BASE}/team/board`, { params: store(storeId) });
  return data;
}

export async function getObjectionStatsD(days: number, storeId?: string): Promise<ObjectionStatsD> {
  const { data } = await axiosAuth.get<ObjectionStatsD>(`${BASE}/content/objections/stats`, {
    params: { days, ...store(storeId) },
  });
  return data;
}

export async function addObjectionLibrary(): Promise<{ added: number }> {
  const { data } = await axiosAuth.post<{ added: number }>(`${BASE}/content/objections/library`);
  return data;
}

export async function updateObjectionD(
  id: string,
  input: { family?: ObjectionFamily; businessAction?: string; actionDone?: boolean },
): Promise<void> {
  await axiosAuth.patch(`${BASE}/content/objections/${id}`, input);
}

export async function getAuditD(storeId?: string): Promise<AuditD> {
  const { data } = await axiosAuth.get<AuditD>(`${BASE}/audit`, { params: store(storeId) });
  return data;
}
