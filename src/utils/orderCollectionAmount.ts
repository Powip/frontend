interface CollectionPayment {
  status: string;
  amount: string | number;
  externalReference?: string | null;
}

interface CollectionOrder {
  grandTotal: string | number;
  externalSource?: string | null;
  payments: readonly CollectionPayment[];
}

/** Collection projection for quotation v1; this never changes payment approval. */
export function getQuotationPendingAdvance(order: CollectionOrder): number {
  if (order.externalSource !== "quotation") return 0;
  return order.payments.reduce(
    (sum, payment) =>
      payment.status === "PENDING" && payment.externalReference?.startsWith("quotation:")
        ? sum + Math.max(0, Number(payment.amount) || 0)
        : sum,
    0,
  );
}

export function getOrderCollectionAmount(order: CollectionOrder): number {
  const paid = order.payments.reduce(
    (sum, payment) =>
      payment.status === "PAID" ? sum + Math.max(0, Number(payment.amount) || 0) : sum,
    0,
  );
  return Math.max(
    0,
    Math.round((Number(order.grandTotal) - paid - getQuotationPendingAdvance(order)) * 100) / 100,
  );
}
