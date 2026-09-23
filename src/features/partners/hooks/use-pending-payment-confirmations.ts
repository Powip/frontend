import { useQuery } from "@tanstack/react-query";
import { partnersKeys } from "../keys/partners.keys";
import type { PendingPaymentConfirmation } from "../models/pending-payment-confirmation";
import { getPendingPaymentConfirmations } from "../services/get-pending-payment-confirmations";

export function usePendingPaymentConfirmations() {
  return useQuery<PendingPaymentConfirmation[], Error>({
    queryKey: partnersKeys.pendingPaymentConfirmations(),
    queryFn: getPendingPaymentConfirmations,
  });
}
