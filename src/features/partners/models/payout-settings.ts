export type PayoutMethodType = "yape" | "plin" | "transferencia";

export interface PayoutSettings {
  method: PayoutMethodType;
  accountNumber: string;
  accountHolder: string;
  minimumThreshold: number;
}
