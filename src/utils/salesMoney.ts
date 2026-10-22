export const formatSalesMoney = (amount: number, currency?: string | null) =>
  `${currency === "PEN" ? "S/" : currency || "Moneda no informada"} ${amount.toFixed(2)}`;

/** Group persisted order amounts; missing currency never implies PEN. */
export function groupSaleBalances(
  rows: readonly {
    currency?: string | null;
    pendingPayment: number;
    advancePayment: number;
  }[],
) {
  const groups = new Map<
    string,
    { currency: string | null; pending: number; paid: number }
  >();
  for (const row of rows) {
    const key = row.currency || "UNKNOWN";
    const group = groups.get(key) ?? {
      currency: row.currency || null,
      pending: 0,
      paid: 0,
    };
    group.pending += row.pendingPayment;
    group.paid += row.advancePayment;
    groups.set(key, group);
  }
  return [...groups.values()];
}
