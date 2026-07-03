import { useQuery } from "@tanstack/react-query";
import { getVendedores } from "@/services/agentesService";

export function useVendedores(companyId: string | null | undefined) {
  return useQuery({
    queryKey: ["vendedores", companyId],
    queryFn: () => getVendedores(companyId!),
    enabled: !!companyId,
    staleTime: 60_000,
  });
}
