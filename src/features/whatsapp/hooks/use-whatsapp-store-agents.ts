import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { getAgentesCC } from "@/services/agentesService";
import { assertWhatsAppContractAvailable } from "../constants/whatsapp-contracts";
import { whatsappKeys } from "../keys/whatsapp.keys";
import type { WhatsAppAgentOption } from "../models/conversation.model";
import type { WhatsAppResourceState } from "../models/resource-state.model";

async function loadStoreAgents(storeId: string, companyId: string): Promise<WhatsAppAgentOption[]> {
  assertWhatsAppContractAvailable("customerServiceAgents");
  const agents = await getAgentesCC(storeId, companyId);
  return agents
    .map((agent) => ({ id: agent.id, name: agent.nombre ?? agent.email ?? "Sin nombre" }))
    .sort((a, b) => a.name.localeCompare(b.name, "es"));
}

export function useWhatsAppStoreAgents(
  storeId: string | null,
  enabled: boolean,
): WhatsAppResourceState<WhatsAppAgentOption[]> {
  const { auth } = useAuth();
  const companyId = auth?.company?.id ?? null;
  const active = enabled && !!storeId && !!companyId;

  const query = useQuery({
    queryKey: whatsappKeys.storeAgents(companyId ?? "none", storeId ?? "none"),
    queryFn: () => loadStoreAgents(storeId as string, companyId as string),
    enabled: active,
    staleTime: 5 * 60 * 1000,
  });

  if (!active) return { kind: "ready", data: [] };
  if (query.isPending) return { kind: "loading" };
  if (query.isError) return { kind: "error", message: "No se pudo cargar la lista de asesoras." };
  return { kind: "ready", data: query.data ?? [] };
}
