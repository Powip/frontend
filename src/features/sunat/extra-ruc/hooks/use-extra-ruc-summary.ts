import { useQuery } from "@tanstack/react-query";
import { getExtraRucSummaryApi } from "../api/extra-ruc.api";
import { extraRucKeys } from "../keys/extra-ruc.keys";
import type { ExtraRucSummary } from "../models/extra-ruc";

/**
 * Resumen de RUC extra de la empresa. Solo lo puede pedir el dueño o un administrador: para el resto
 * responde 403 y data queda sin definir (la pantalla sigue funcionando sin los precios).
 */
export function useExtraRucSummary() {
  return useQuery<ExtraRucSummary, Error>({
    queryKey: extraRucKeys.summary(),
    queryFn: getExtraRucSummaryApi,
    retry: false,
    staleTime: 30_000,
  });
}
