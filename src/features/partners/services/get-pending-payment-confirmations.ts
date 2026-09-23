import { listPendingPaymentConfirmations } from "../mocks/pending-payment-confirmations.store";
import type { PendingPaymentConfirmation } from "../models/pending-payment-confirmation";

export async function getPendingPaymentConfirmations(): Promise<PendingPaymentConfirmation[]> {
  await new Promise((resolve) => setTimeout(resolve, 300));
  return listPendingPaymentConfirmations();
}
