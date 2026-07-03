import { useQuery } from "@tanstack/react-query";
import { DateRange } from "react-day-picker";
import { getAgentesPerformance } from "@/services/agentesService";

export function useAgentePerformance(
  storeId: string | null | undefined,
  companyId: string | null | undefined,
  range: DateRange,
) {
  const startDate = range.from?.toISOString();
  const endDate = range.to?.toISOString();

  return useQuery({
    queryKey: ["cc-agentes-kpis", storeId, companyId, startDate, endDate],
    queryFn: () =>
      getAgentesPerformance(storeId!, companyId!, startDate!, endDate!),
    enabled: !!storeId && !!companyId && !!startDate && !!endDate,
    staleTime: 60_000,
  });
}
