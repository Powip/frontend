import type { PendingPaymentConfirmation } from "../models/pending-payment-confirmation";

export const PENDING_PAYMENT_CONFIRMATIONS_MOCK: PendingPaymentConfirmation[] = [
  { id: "ppc-kunca-deco", businessName: "Kunca Deco", partnerName: "Joel Coila", statusNote: "cuenta creada", confirmed: false },
  { id: "ppc-cafe-norte", businessName: "Café Norte", partnerName: "María Torres", statusNote: "cuenta creada", confirmed: false },
];
