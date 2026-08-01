import { Payment } from "@/models/sales/payment";
import { PaymentResponseDto } from "../dto/order.dto";

export function toPayment(
  dto: PaymentResponseDto
): Payment {
  return {
    id: dto.id,

    paymentMethod: dto.paymentMethod,
    amount: Number(dto.amount),

    externalReference: dto.externalReference,
    paymentProofUrl: dto.paymentProofUrl,

    status: dto.status,
    notes: dto.notes,

    paymentDate: new Date(dto.paymentDate),

    createdAt: new Date(dto.created_at),
    updatedAt: new Date(dto.updated_at),
  };
}
