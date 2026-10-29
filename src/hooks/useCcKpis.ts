import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { getKpisCC } from "@/services/atencionClienteService";
import { TipoGestionCC } from "@/interfaces/IOrder";

export function useCcKpis(tipoGestion: TipoGestionCC, storeId: string | string[] | null | undefined) {
  const { auth } = useAuth();
  return useQuery({
    queryKey: ["cc-kpis", auth?.company?.id, auth?.user?.id, tipoGestion, storeId],
    queryFn: ({ signal }) => getKpisCC(tipoGestion, storeId!, signal),
    enabled: !!auth?.accessToken && (Array.isArray(storeId) ? storeId.length > 0 : !!storeId),
    retry: false,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}
