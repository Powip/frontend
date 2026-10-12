import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { DateRange } from "react-day-picker";
import { getAgentesPerformance } from "@/services/agentesService";

export function useAgentePerformance(
  storeId: string | string[] | null | undefined,
  companyId: string | null | undefined,
  range: DateRange,
) {
  const { auth } = useAuth();
  const startDate = range.from?.toISOString();
  const endDate = range.to?.toISOString();

  return useQuery({
    queryKey: ["cc-agentes-kpis", storeId, companyId, auth?.user?.id, startDate, endDate],
    queryFn: ({ signal }) =>
      getAgentesPerformance(storeId!, companyId!, startDate!, endDate!, signal),
    enabled: !!auth?.accessToken && (Array.isArray(storeId) ? storeId.length > 0 : !!storeId) && !!companyId && !!startDate && !!endDate,
    retry: false,
    staleTime: 60_000,
  });
}
