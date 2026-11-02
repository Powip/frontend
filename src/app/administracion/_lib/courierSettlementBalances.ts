import type { CourierCollection } from "@/services/courierSettlementsService";

export interface CourierSettlementBalance {
  key: string;
  courierName: string;
  currency: string;
  collections: number;
  remainingAmount: number;
  reservedAmount: number;
}

/** Only confirmed collections create a courier receivable; delivery alone does not. */
export function courierSettlementBalances(collections: readonly CourierCollection[]): CourierSettlementBalance[] {
  const grouped = new Map<string, CourierSettlementBalance>();
  for (const collection of collections) {
    if (!Number.isFinite(collection.remainingAmount) || collection.remainingAmount <= 0) continue;
    const key = `${collection.courierId}:${collection.currency}`;
    const balance = grouped.get(key) ?? {
      key, courierName: collection.courierName, currency: collection.currency,
      collections: 0, remainingAmount: 0, reservedAmount: 0,
    };
    balance.collections += 1;
    balance.remainingAmount = (Math.round(balance.remainingAmount * 100) + Math.round(collection.remainingAmount * 100)) / 100;
    balance.reservedAmount = (Math.round(balance.reservedAmount * 100) + Math.round(collection.reservedAmount * 100)) / 100;
    grouped.set(key, balance);
  }
  return [...grouped.values()].sort((a, b) => a.courierName.localeCompare(b.courierName) || a.currency.localeCompare(b.currency));
}
