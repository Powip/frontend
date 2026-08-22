import { IAgenteIA } from "@/interfaces/superadmin";
import { agentesIaMock } from "@/mocks/superadmin";
import { mockDelay } from "./shared";

export async function getAgentes(): Promise<IAgenteIA[]> {
  return mockDelay([...agentesIaMock]);
}

export async function getKpisAgentes() {
  const total = agentesIaMock.length;
  const activos = agentesIaMock.filter((a) => a.activo).length;
  const interaccionesTotales = agentesIaMock.reduce((sum, a) => sum + a.usoMes, 0);
  const cierresAsistidos = agentesIaMock.reduce((sum, a) => sum + (a.cierresAsistidos ?? 0), 0);
  return mockDelay({ total, activos, interaccionesTotales, cierresAsistidos });
}

export async function toggleAgente(id: string): Promise<IAgenteIA | null> {
  const agente = agentesIaMock.find((a) => a.id === id);
  if (!agente) return mockDelay(null);
  agente.activo = !agente.activo;
  return mockDelay(agente, 350);
}
