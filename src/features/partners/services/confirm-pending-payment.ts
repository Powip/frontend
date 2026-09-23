import { confirmPendingPaymentInStore } from "../mocks/pending-payment-confirmations.store";
import type { PendingPaymentConfirmation } from "../models/pending-payment-confirmation";

export async function confirmPendingPayment(id: string): Promise<PendingPaymentConfirmation> {
  await new Promise((resolve) => setTimeout(resolve, 300));

  const updated = confirmPendingPaymentInStore(id);
  if (!updated) {
    throw new Error("Referido no encontrado");
  }

  return updated;
}
