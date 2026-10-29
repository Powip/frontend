import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { getAgentesCC } from "@/services/agentesService";

export function useAgentes(
  storeId: string | string[] | null | undefined,
  companyId?: string | null,
) {
  const { auth } = useAuth();
  return useQuery({
    queryKey: ["cc-agentes", auth?.user?.id, storeId, companyId],
    queryFn: ({ signal }) => getAgentesCC(storeId!, companyId ?? undefined, signal),
    enabled: !!auth?.accessToken && (Array.isArray(storeId) ? storeId.length > 0 : !!storeId) && !!companyId,
    retry: false,
    refetchInterval: 30_000,
    staleTime: 15_000,
  });
}
