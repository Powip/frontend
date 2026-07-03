import { useQuery } from "@tanstack/react-query";
import { DateRange } from "react-day-picker";
import { getUpsellRecords } from "@/services/atencionClienteService";

export function useUpsellRecords(
  storeId: string | null | undefined,
  range: DateRange | undefined,
) {
  const startDate = range?.from?.toISOString();
  const endDate   = range?.to?.toISOString();

  return useQuery({
    queryKey: ["upsell-records", storeId, startDate, endDate],
    queryFn: () => getUpsellRecords(storeId!, startDate!, endDate!),
    enabled: !!storeId && !!startDate && !!endDate,
    staleTime: 5 * 60_000, // 5 min — alineado con el resto de hooks Cc de dashboard
    refetchOnWindowFocus: false,
  });
}
