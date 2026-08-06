import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  deleteCierreDiaDay,
  getCierreDiaDay,
  getCierreDiaMonth,
  getCierreDiaRange,
  saveCierreDiaDay,
} from "@/services/cierreDiaService";
import { getCierreDiaClosingData, isoDayBounds, isoRangeBounds } from "@/services/cierreDiaProductosService";
import { CierreDiaFormInput } from "@/interfaces/ICierreDia";

export function useCierreDiaDay(storeId: string | null | undefined, date: string) {
  return useQuery({
    queryKey: ["cierre-dia", "day", storeId, date],
    queryFn: () => getCierreDiaDay(storeId!, date),
    enabled: !!storeId && !!date,
  });
}

export function useCierreDiaRange(
  storeId: string | null | undefined,
  startDate: string,
  endDate: string,
) {
  return useQuery({
    queryKey: ["cierre-dia", "range", storeId, startDate, endDate],
    queryFn: () => getCierreDiaRange(storeId!, startDate, endDate),
    enabled: !!storeId && !!startDate && !!endDate,
  });
}

export function useCierreDiaMonth(storeId: string | null | undefined, monthStr: string) {
  return useQuery({
    queryKey: ["cierre-dia", "month", storeId, monthStr],
    queryFn: () => getCierreDiaMonth(storeId!, monthStr),
    enabled: !!storeId && !!monthStr,
  });
}

export function useSaveCierreDia(storeId: string | null | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ date, input }: { date: string; input: CierreDiaFormInput }) =>
      saveCierreDiaDay(storeId!, date, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cierre-dia", "day", storeId] });
      queryClient.invalidateQueries({ queryKey: ["cierre-dia", "range", storeId] });
      queryClient.invalidateQueries({ queryKey: ["cierre-dia", "month", storeId] });
    },
  });
}

/** Rendimiento por producto + resumen de upsell — un solo día. */
export function useCierreDiaClosingDataDay(storeId: string | null | undefined, date: string) {
  return useQuery({
    queryKey: ["cierre-dia", "closing-data", storeId, date],
    queryFn: () => {
      const { startDate, endDate } = isoDayBounds(date);
      return getCierreDiaClosingData(storeId!, startDate, endDate);
    },
    enabled: !!storeId && !!date,
    staleTime: 60_000,
    retry: 1,
  });
}

/** Rendimiento por producto + resumen de upsell — rango de fechas (YYYY-MM-DD). */
export function useCierreDiaClosingDataRange(
  storeId: string | null | undefined,
  startDate: string,
  endDate: string,
) {
  return useQuery({
    queryKey: ["cierre-dia", "closing-data", storeId, startDate, endDate],
    queryFn: () => {
      const bounds = isoRangeBounds(startDate, endDate);
      return getCierreDiaClosingData(storeId!, bounds.startDate, bounds.endDate);
    },
    enabled: !!storeId && !!startDate && !!endDate,
    staleTime: 60_000,
    retry: 1,
  });
}

export function useDeleteCierreDia(storeId: string | null | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (date: string) => deleteCierreDiaDay(storeId!, date),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cierre-dia", "day", storeId] });
      queryClient.invalidateQueries({ queryKey: ["cierre-dia", "range", storeId] });
      queryClient.invalidateQueries({ queryKey: ["cierre-dia", "month", storeId] });
    },
  });
}
