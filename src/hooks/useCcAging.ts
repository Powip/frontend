import { useQuery } from "@tanstack/react-query";
import { DateRange } from "react-day-picker";
import { getKpisAging } from "@/services/atencionClienteService";

export function useCcAging(
  storeId: string | null | undefined,
  range: DateRange | undefined,
) {
  const startDate = range?.from?.toISOString();
  const endDate   = range?.to?.toISOString();

  return useQuery({
    queryKey: ["cc-kpis-aging", storeId, startDate, endDate],
    queryFn: () => getKpisAging(storeId!, startDate!, endDate!),
    enabled: !!storeId && !!startDate && !!endDate,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}
