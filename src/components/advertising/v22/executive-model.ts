import type {
  AdsExecutiveGroup,
  AdsExecutiveMetric,
  AdsSummary,
} from "@/services/advertisingV22Service";
import { dateRange, numeric, ratio, spendRows, sumSpend, summarySpendAvailable } from "./model";

export function executiveTotal(rows: AdsExecutiveGroup[]): AdsExecutiveMetric {
  const count = (
    key:
      | "orders"
      | "confirmed"
      | "delivered"
      | "cancelled"
      | "units"
      | "deliveredUnits"
      | "attributedOrders"
      | "attributedConfirmed"
      | "attributedDelivered"
      | "unattributedOrders",
  ) => rows.reduce((sum, row) => sum + row[key], 0);
  const amount = (
    key:
      | "orderRevenue"
      | "deliveredRevenue"
      | "attributedOrderRevenue"
      | "attributedDeliveredRevenue",
  ) =>
    rows.some((row) => numeric(row[key]) === null)
      ? null
      : String(rows.reduce((sum, row) => sum + (numeric(row[key]) ?? 0), 0));
  const orders = count("orders"),
    confirmed = count("confirmed"),
    delivered = count("delivered"),
    deliveredUnits = count("deliveredUnits"),
    revenue = amount("deliveredRevenue");
  return {
    orders,
    confirmed,
    delivered,
    deliveredUnits,
    units: count("units"),
    cancelled: count("cancelled"),
    attributedOrders: count("attributedOrders"),
    attributedConfirmed: count("attributedConfirmed"),
    comparableAttributedOrders: rows.reduce(
      (sum, row) => sum + (row.comparableAttributedOrders ?? row.attributedOrders),
      0,
    ),
    comparableAttributedConfirmed: rows.reduce(
      (sum, row) => sum + (row.comparableAttributedConfirmed ?? row.attributedConfirmed),
      0,
    ),
    comparableAttributedDelivered: rows.reduce(
      (sum, row) => sum + (row.comparableAttributedDelivered ?? row.attributedDelivered),
      0,
    ),
    comparableAttributedDeliveredUnits: rows.some(
      (row) => row.comparableAttributedDeliveredUnits === undefined,
    )
      ? undefined
      : rows.reduce((sum, row) => sum + (row.comparableAttributedDeliveredUnits ?? 0), 0),
    unknownCurrencyOrders: rows.reduce((sum, row) => sum + (row.unknownCurrencyOrders ?? 0), 0),
    excludedCurrencyOrders: rows.reduce((sum, row) => sum + (row.excludedCurrencyOrders ?? 0), 0),
    attributedDelivered: count("attributedDelivered"),
    attributedDeliveredUnits: rows.some((row) => row.attributedDeliveredUnits === undefined)
      ? undefined
      : rows.reduce((sum, row) => sum + (row.attributedDeliveredUnits ?? 0), 0),
    unattributedOrders: count("unattributedOrders"),
    orderRevenue: amount("orderRevenue"),
    deliveredRevenue: revenue,
    attributedOrderRevenue: amount("attributedOrderRevenue"),
    attributedDeliveredRevenue: amount("attributedDeliveredRevenue"),
    confirmationRate: ratio(confirmed, orders),
    deliveryRate: ratio(delivered, confirmed),
    deliveredTicketPerOrder: ratio(numeric(revenue), delivered),
    deliveredTicketPerUnit: ratio(numeric(revenue), deliveredUnits),
  };
}
export function executiveSpend(
  summary: AdsSummary,
  storeId: string,
  accountId = "all",
  date?: string,
  channel = "all",
) {
  const days = date ? [date] : dateRange(summary.from, summary.to);
  const accountDays = summary.quality.accountDays?.filter(
    (row) =>
      row.currency === "PEN" &&
      (accountId === "all" || row.accountId === accountId) &&
      days.includes(row.date),
  );
  if (accountId !== "all") {
    if (
      !accountDays?.length ||
      days.some((day) => !accountDays.some((row) => row.date === day && row.spendAvailable))
    )
      return null;
    if (storeId !== "all" && !summarySpendAvailable(summary, storeId, date)) return null;
  } else if (!summarySpendAvailable(summary, storeId, date)) return null;
  return sumSpend(
    spendRows(summary, storeId, channel).filter(
      (row) => (accountId === "all" || row.accountId === accountId) && (!date || row.date === date),
    ),
  );
}
export function executiveEfficiency(
  metric: AdsExecutiveMetric,
  spend: number | null,
  comparable = true,
) {
  const value = comparable ? spend : null;
  return {
    costOrder: ratio(value, metric.comparableAttributedOrders ?? metric.attributedOrders),
    costConfirmed: ratio(value, metric.comparableAttributedConfirmed ?? metric.attributedConfirmed),
    costDelivered: ratio(value, metric.comparableAttributedDelivered ?? metric.attributedDelivered),
    roasOrders: ratio(numeric(metric.attributedOrderRevenue), value),
    roasDelivered: ratio(numeric(metric.attributedDeliveredRevenue), value),
  };
}

export function comparableAccounts(summary: AdsSummary, accountId = "all") {
  const accounts = summary.accounts?.filter((row) => accountId === "all" || row.id === accountId);
  return (
    !!accounts?.length &&
    accounts.every((row) => row.currency === "PEN" && row.timeZone === "America/Lima")
  );
}
