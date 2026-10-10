export interface PendingPaymentConfirmation {
  id: string;
  businessName: string;
  partnerName: string;
  statusNote: string;
  confirmed: boolean;
}
