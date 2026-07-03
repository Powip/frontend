import { useQuery } from "@tanstack/react-query";
import { DateRange } from "react-day-picker";
import { getStorePerformance } from "@/services/atencionClienteService";

export function useCcStorePerformance(
  storeId: string | null | undefined,
  range: DateRange | undefined,
) {
  const startDate = range?.from?.toISOString();
  const endDate   = range?.to?.toISOString();

  return useQuery({
    queryKey: ["cc-store-performance", storeId, startDate, endDate],
    queryFn: () => getStorePerformance(storeId!, startDate!, endDate!),
    enabled: !!storeId && !!startDate && !!endDate,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}
