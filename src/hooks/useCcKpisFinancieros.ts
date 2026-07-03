import { useQuery } from "@tanstack/react-query";
import { DateRange } from "react-day-picker";
import { getKpisFinancieros } from "@/services/atencionClienteService";

export function useCcKpisFinancieros(
  storeId: string | null | undefined,
  range: DateRange | undefined,
) {
  const startDate = range?.from?.toISOString();
  const endDate   = range?.to?.toISOString();

  return useQuery({
    queryKey: ["cc-kpis-financieros", storeId, startDate, endDate],
    queryFn: () => getKpisFinancieros(storeId!, startDate!, endDate!),
    enabled: !!storeId && !!startDate && !!endDate,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}
