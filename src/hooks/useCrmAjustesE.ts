"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { crmError } from "@/services/crmService";
import { getCrmSettingsE, getSalesBoardExtras, updateCrmSettingsE } from "@/services/crmAjustesEService";
import { teamKeys } from "@/hooks/useCrmTeam";
import type { CrmSettingsE, CrmSettingsEInput, SalesBoardExtra } from "@/types/crmAjustesE";

/** Comparte caché con `useCrmSettings`: es el mismo recurso con más campos tipados. */
export function useCrmSettingsE(enabled = true) {
  return useQuery({ queryKey: teamKeys.settings, queryFn: getCrmSettingsE, retry: false, enabled });
}

export function useUpdateCrmSettingsE() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CrmSettingsEInput) => updateCrmSettingsE(input),
    onSuccess: (settings: CrmSettingsE) => {
      qc.setQueryData(teamKeys.settings, settings);
      toast.success("Ajuste guardado");
    },
    onError: (err: unknown) => toast.error(crmError(err).message),
  });
}

/** Ventas (V3): datos del Core por pedido, indexados por `orderId`. */
export function useSalesBoardExtras(orderIds: string[]) {
  const ids = [...new Set(orderIds.filter(Boolean))].slice(0, 60).sort();
  return useQuery({
    queryKey: ["crm", "sales", "extras", ids.join(",")] as const,
    queryFn: async () => {
      const items = await getSalesBoardExtras(ids);
      return Object.fromEntries(items.map((x) => [x.orderId, x])) as Record<string, SalesBoardExtra>;
    },
    enabled: ids.length > 0,
    retry: false,
    staleTime: 60_000,
  });
}
