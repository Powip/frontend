import { useQuery } from "@tanstack/react-query";
import { DateRange } from "react-day-picker";
import { getKpisIntentos } from "@/services/atencionClienteService";

export function useCcIntentos(
  storeId: string | null | undefined,
  range: DateRange | undefined,
) {
  const startDate = range?.from?.toISOString();
  const endDate   = range?.to?.toISOString();

  return useQuery({
    queryKey: ["cc-kpis-intentos", storeId, startDate, endDate],
    queryFn: () => getKpisIntentos(storeId!, startDate!, endDate!),
    enabled: !!storeId && !!startDate && !!endDate,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}
