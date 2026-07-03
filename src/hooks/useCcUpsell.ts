import { useQuery } from "@tanstack/react-query";
import { DateRange } from "react-day-picker";
import { getKpisUpsell } from "@/services/atencionClienteService";

export function useCcUpsell(
  storeId: string | null | undefined,
  range: DateRange | undefined,
) {
  const startDate = range?.from?.toISOString();
  const endDate   = range?.to?.toISOString();

  return useQuery({
    queryKey: ["cc-kpis-upsell", storeId, startDate, endDate],
    queryFn: () => getKpisUpsell(storeId!, startDate!, endDate!),
    enabled: !!storeId && !!startDate && !!endDate,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}
