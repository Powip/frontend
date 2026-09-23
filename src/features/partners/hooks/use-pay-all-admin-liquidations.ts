import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { partnersKeys } from "../keys/partners.keys";
import type { AdminLiquidationRow } from "../models/admin-liquidation-row";
import { payAllAdminLiquidations } from "../services/pay-all-admin-liquidations";

export function usePayAllAdminLiquidations() {
  const queryClient = useQueryClient();

  return useMutation<AdminLiquidationRow[], Error, void>({
    mutationFn: payAllAdminLiquidations,

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: partnersKeys.adminLiquidations() });
      toast.success("Ciclo liquidado");
    },

    onError: () => {
      toast.error("No pudimos liquidar el ciclo. Intenta de nuevo.");
    },
  });
}
