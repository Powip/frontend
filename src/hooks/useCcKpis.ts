import { useQuery } from "@tanstack/react-query";
import { getKpisCC } from "@/services/atencionClienteService";
import { TipoGestionCC } from "@/interfaces/IOrder";

export function useCcKpis(tipoGestion: TipoGestionCC, storeId: string | null | undefined) {
  return useQuery({
    queryKey: ["cc-kpis", tipoGestion, storeId],
    queryFn: () => getKpisCC(tipoGestion, storeId!),
    enabled: !!storeId,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}
