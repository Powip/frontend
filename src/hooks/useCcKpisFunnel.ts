import { useQuery } from "@tanstack/react-query";
import { DateRange } from "react-day-picker";
import { getKpisFunnel } from "@/services/atencionClienteService";

export function useCcKpisFunnel(
  storeId: string | null | undefined,
  range: DateRange | undefined,
) {
  const startDate = range?.from?.toISOString();
  const endDate   = range?.to?.toISOString();

  return useQuery({
    queryKey: ["cc-kpis-funnel", storeId, startDate, endDate],
    queryFn: () => getKpisFunnel(storeId!, startDate!, endDate!),
    enabled: !!storeId && !!startDate && !!endDate,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}
