import { useQuery } from "@tanstack/react-query";
import { getAgentesCC } from "@/services/agentesService";

export function useAgentes(
  storeId: string | null | undefined,
  companyId?: string | null,
) {
  return useQuery({
    queryKey: ["cc-agentes", storeId, companyId],
    queryFn: () => getAgentesCC(storeId!, companyId ?? undefined),
    enabled: !!storeId && !!companyId,
    refetchInterval: 30_000,
    staleTime: 15_000,
  });
}
