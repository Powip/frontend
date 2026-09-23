import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { partnersKeys } from "../keys/partners.keys";
import type { PendingPaymentConfirmation } from "../models/pending-payment-confirmation";
import { confirmPendingPayment } from "../services/confirm-pending-payment";

export function useConfirmPendingPayment() {
  const queryClient = useQueryClient();

  return useMutation<PendingPaymentConfirmation, Error, string>({
    mutationFn: confirmPendingPayment,

    onSuccess: (item) => {
      queryClient.invalidateQueries({ queryKey: partnersKeys.pendingPaymentConfirmations() });
      toast.success(`Pago de ${item.businessName} confirmado · comisión activada`);
    },

    onError: () => {
      toast.error("No pudimos confirmar el pago. Intenta de nuevo.");
    },
  });
}
