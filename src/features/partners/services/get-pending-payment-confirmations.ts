import type { PendingPaymentConfirmation } from "../models/pending-payment-confirmation";
import { unavailablePartnersFeature } from "../utils/unavailable-partners-feature";

export async function getPendingPaymentConfirmations(): Promise<PendingPaymentConfirmation[]> {
  return unavailablePartnersFeature("Consultar pagos pendientes");
}
