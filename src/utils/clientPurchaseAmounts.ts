import type { Client } from "@/interfaces/ICliente";

/** Display server totals by their persisted currency; never sum or infer FX. */
export function clientPurchaseAmounts(
  client: Pick<
    Client,
    "purchaseAmountsByCurrency" | "purchaseCurrency" | "totalPurchaseAmount"
  >,
): string {
  const amounts = client.purchaseAmountsByCurrency;
  if (amounts)
    return amounts.length
      ? amounts
          .map(
            ({ currency, amount }) =>
              `${currency || "Moneda no informada"} ${Number(amount).toFixed(2)}`,
          )
          .join(" · ")
      : "—";
  return client.totalPurchaseAmount == null
    ? "—"
    : `${client.purchaseCurrency || "Moneda no informada"} ${Number(client.totalPurchaseAmount).toFixed(2)}`;
}
