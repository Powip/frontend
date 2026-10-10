import { PENDING_PAYMENT_CONFIRMATIONS_MOCK } from "./pending-payment-confirmations.mock";
import type { PendingPaymentConfirmation } from "../models/pending-payment-confirmation";

let confirmations: PendingPaymentConfirmation[] = [...PENDING_PAYMENT_CONFIRMATIONS_MOCK];

export function listPendingPaymentConfirmations(): PendingPaymentConfirmation[] {
  return confirmations;
}

export function confirmPendingPaymentInStore(id: string): PendingPaymentConfirmation | undefined {
  let updated: PendingPaymentConfirmation | undefined;
  confirmations = confirmations.map((item) => {
    if (item.id !== id) return item;
    updated = { ...item, confirmed: true };
    return updated;
  });
  return updated;
}

export function resetPendingPaymentConfirmationsStore(): void {
  confirmations = [...PENDING_PAYMENT_CONFIRMATIONS_MOCK];
}
