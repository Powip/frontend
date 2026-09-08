import type { PaymentMethod, PaymentStatus } from "@/features/sales/types/order.types";

export interface Payment {
  id: string;

  paymentMethod: PaymentMethod;
  amount: number;

  externalReference: string | null;
  paymentProofUrl: string | null;

  status: PaymentStatus;
  notes: string | null;

  paymentDate: Date;

  createdAt: Date;
  updatedAt: Date;
}
