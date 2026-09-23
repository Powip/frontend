import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { partnersKeys } from "../keys/partners.keys";
import type { AdminLiquidationRow } from "../models/admin-liquidation-row";
import { payAdminLiquidation } from "../services/pay-admin-liquidation";

export function usePayAdminLiquidation() {
  const queryClient = useQueryClient();

  return useMutation<AdminLiquidationRow, Error, string>({
    mutationFn: payAdminLiquidation,

    onSuccess: (row) => {
      queryClient.invalidateQueries({ queryKey: partnersKeys.adminLiquidations() });
      toast.success(`Pago a ${row.partnerName} marcado como pagado`);
    },

    onError: () => {
      toast.error("No pudimos marcar el pago. Intenta de nuevo.");
    },
  });
}
