export interface ProofPayment {
  id: string;
  status: "PENDING" | "PAID" | "LOST";
}

export interface SavedOrderProof {
  orderId: string;
  paymentId?: string;
  previousPaymentIds: string[];
}

/** Never guess between several payments or attach a new advance to an old one. */
export function resolvePaymentProofTarget(
  payments: ProofPayment[],
  context: SavedOrderProof,
): string | undefined {
  if (context.paymentId) {
    return payments.find(
      (payment) => payment.id === context.paymentId && payment.status !== "LOST",
    )?.id;
  }

  const candidates = payments.filter(
    (payment) =>
      payment.status !== "LOST" &&
      !context.previousPaymentIds.includes(payment.id),
  );
  return candidates.length === 1 ? candidates[0].id : undefined;
}
