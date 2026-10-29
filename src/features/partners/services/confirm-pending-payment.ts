import type { PendingPaymentConfirmation } from "../models/pending-payment-confirmation";
import { unavailablePartnersFeature } from "../utils/unavailable-partners-feature";

export async function confirmPendingPayment(id: string): Promise<PendingPaymentConfirmation> {
  void id;
  return unavailablePartnersFeature("Confirmar un pago del referido");
}
