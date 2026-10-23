import {
  addDays,
  addMonths,
  endOfMonth,
  format,
  parseISO,
  startOfMonth,
  startOfWeek,
  subDays,
} from "date-fns";
import type {
  AdsProduct,
  AdsDay,
  AdsRules,
  AdsRow,
  AdsSales,
  AdsSummary,
  SalesGroup,
  SalesMetric,
} from "@/services/advertisingV22Service";

export const dayKey = (value: Date) => format(value, "yyyy-MM-dd");
export const limaToday = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Lima",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
export const numeric = (value: string | number | null | undefined): number | null =>
  value == null || value === "" || !Number.isFinite(Number(value)) ? null : Number(value);
export const ratio = (a: number | null, b: number | null) =>
  a === null || b === null || b <= 0 ? null : a / b;
export function profitUsage(cost: number | null, maximum: number | null) {
  if (cost === null || maximum === null) return null;
  return maximum <= 0 ? (cost > maximum ? Infinity : 1) : cost / maximum;
}
export const money = (value: number | null | undefined, currency: string | null = "PEN") =>
  value == null || !currency
    ? "—"
    : new Intl.NumberFormat("es-PE", { style: "currency", currency }).format(value);
export function commonCurrency(rows: ReadonlyArray<{ currency: string }>): string | null {
  const currency = rows[0]?.currency;
  return currency && rows.every((row) => row.currency === currency) ? currency : null;
}
export function currencyTotal(
  rows: ReadonlyArray<{ currency: string; amount: number | null | undefined }>,
) {
  const currency = commonCurrency(rows);
  return {
    currency,
    amount:
      currency && rows.every((row) => row.amount != null && Number.isFinite(row.amount))
        ? rows.reduce((sum, row) => sum + row.amount!, 0)
        : null,
  };
}
export const decimal = (value: number | null | undefined, suffix = "") =>
  value == null
    ? "—"
    : `${new Intl.NumberFormat("es-PE", { maximumFractionDigits: 2 }).format(value)}${suffix}`;
export const pct = (value: number | null | undefined) =>
  value == null ? "—" : `${decimal(value * 100)}%`;
export function dateRange(from: string, to: string) {
  const result: string[] = [];
  for (
    let date = parseISO(from);
    date <= parseISO(to) && result.length < 367;
    date = addDays(date, 1)
  )
    result.push(dayKey(date));
  return result;
}
export function comparisonPeriod(from: string, to: string, today = limaToday()) {
  const effectiveTo = to < today ? to : today;
  const monthStart = dayKey(startOfMonth(parseISO(from)));
  const monthEnd = dayKey(endOfMonth(parseISO(from)));
  if (from === monthStart && to === monthEnd) {
    const previous = addMonths(parseISO(from), -1);
    const previousEnd = endOfMonth(previous);
    const until = new Date(
      previous.getFullYear(),
      previous.getMonth(),
      Math.min(parseISO(effectiveTo).getDate(), previousEnd.getDate()),
    );
    return { from: dayKey(previous), to: dayKey(until), effectiveTo };
  }
  const length = Math.max(1, dateRange(from, effectiveTo).length);
  return {
    from: dayKey(subDays(parseISO(from), length)),
    to: dayKey(subDays(parseISO(from), 1)),
    effectiveTo,
  };
}
export const emptySales = (): SalesMetric => ({
  orders: 0,
  units: 0,
  confirmed: 0,
  delivered: 0,
  inTransit: 0,
  deliveredUnits: 0,
  cancelled: 0,
  billedRevenue: "0",
  productCost: "0",
  shippingCost: "0",
  eligibleRevenue: "0",
  eligibleProductCost: "0",
  eligibleShippingCost: "0",
  missingCostOrders: 0,
  attributedOrders: 0,
});
export function sumSales(rows: SalesMetric[]): SalesMetric {
  const result = emptySales();
  const counts = [
    "orders",
    "units",
    "confirmed",
    "delivered",
    "inTransit",
    "deliveredUnits",
    "cancelled",
    "missingCostOrders",
    "attributedOrders",
    "eligibleDelivered",
    "eligibleDeliveredUnits",
    "billedUnits",
    "eligibleBilledUnits",
    "inTransitUnits",
  ] as const;
  const amounts = [
    "billedRevenue",
    "productCost",
    "shippingCost",
    "eligibleRevenue",
    "eligibleProductCost",
    "eligibleShippingCost",
    "inTransitRevenue",
    "inTransitProductCost",
    "inTransitShippingCost",
  ] as const;
  for (const key of counts) result[key] = rows.reduce((sum, row) => sum + (row[key] ?? 0), 0);
  for (const key of amounts) {
    const values = rows.map((row) => numeric(row[key]));
    result[key] = values.some((value) => value === null)
      ? (null as never)
      : String(values.reduce<number>((sum, value) => sum + (value ?? 0), 0));
  }
  return result;
}
export function paidRows(rows: SalesGroup[], storeId = "all", channel = "all") {
  return rows.filter(
    (row) =>
      row.channel !== "other" &&
      (storeId === "all" || row.storeId === storeId) &&
      (channel === "all" || row.channel === channel),
  );
}
export function spendRows(summary: AdsSummary, storeId = "all", channel = "all") {
  return summary.days.filter(
    (row) =>
      row.currency === "PEN" &&
      (storeId === "all" || row.storeId === storeId) &&
      (channel === "all" || row.channel === channel),
  );
}
export function sumSpend(rows: Array<{ spend: string | null }>): number | null {
  if (rows.some((row) => row.spend === null)) return null;
  return rows.reduce((sum, row) => sum + (numeric(row.spend) ?? 0), 0);
}
export function summarySpendAvailable(summary: AdsSummary) {
  return (
    summary.quality.spendAvailable ??
    (!summary.quality.coverage || summary.quality.coverage === "complete")
  );
}
export type FinancialIssue =
  | "attribution"
  | "store"
  | "channel"
  | "results"
  | "product"
  | "historical-cost"
  | "partial-cost"
  | "spend"
  | "currency";
export interface FinancialEvidence {
  basis: "measured" | "estimated";
  partial: boolean;
  attributionCoverage: number | null;
  costCoverage: number | null;
  issues: FinancialIssue[];
}
export interface Financial {
  evidence?: FinancialEvidence;
  spend: number | null;
  orders: number;
  confirmed: number;
  delivered: number;
  inTransit: number;
  units: number;
  deliveredUnits: number;
  revenue: number | null;
  gain: number | null;
  maximum: number | null;
  costOrder: number | null;
  costConfirmed: number | null;
  costSale: number | null;
  costUnit: number | null;
  projectedSales: number | null;
  projectedCost: number | null;
  projectedGain: number | null;
  roas: number | null;
  projectedRoas: number | null;
  ticket: number | null;
  gainUnit: number | null;
  missingCosts: number;
  attributed: number;
  projectedUnits: number | null;
  usage: number | null;
}
export function financial(
  spend: number | null,
  sales: SalesMetric,
  deliveryRate: number | null,
): Financial {
  const revenue = numeric(sales.billedRevenue);
  const eligibleRevenue = numeric(sales.eligibleRevenue);
  const productCost = numeric(sales.eligibleProductCost);
  const shippingCost = numeric(sales.eligibleShippingCost);
  const contribution =
    eligibleRevenue === null || productCost === null || shippingCost === null
      ? null
      : eligibleRevenue - productCost - shippingCost;
  const eligibleDelivered =
    "eligibleDelivered" in sales && typeof sales.eligibleDelivered === "number"
      ? sales.eligibleDelivered
      : Math.max(0, sales.delivered - sales.missingCostOrders);
  const maximum = ratio(contribution, eligibleDelivered);
  const ticket = ratio(revenue, sales.delivered);
  const expected =
    sales.inTransit === 0 ? 0 : deliveryRate === null ? null : sales.inTransit * deliveryRate;
  const projectedSales = expected === null ? null : sales.delivered + expected;
  const gain =
    contribution === null ||
    spend === null ||
    ((sales.eligibleBilledUnits ?? eligibleDelivered) === 0 && sales.missingCostOrders > 0)
      ? null
      : contribution - spend;
  const transitRevenue = numeric(sales.inTransitRevenue);
  const transitProductCost = numeric(sales.inTransitProductCost);
  const transitShippingCost = numeric(sales.inTransitShippingCost);
  const projectedGain =
    expected === 0 ||
    (transitRevenue === 0 && transitProductCost === 0 && transitShippingCost === 0)
      ? gain
      : deliveryRate === null ||
          transitRevenue === null ||
          transitProductCost === null ||
          transitShippingCost === null ||
          gain === null
        ? null
        : gain + (transitRevenue - transitProductCost - transitShippingCost) * deliveryRate;
  const projectedRevenue =
    expected === 0 || transitRevenue === 0
      ? revenue
      : deliveryRate === null || transitRevenue === null || revenue === null
        ? null
        : revenue + transitRevenue * deliveryRate;
  const unitRate = ratio(sales.deliveredUnits, sales.delivered);
  const projectedUnits =
    expected === 0
      ? sales.deliveredUnits
      : deliveryRate === null || sales.inTransitUnits == null
        ? null
        : sales.deliveredUnits + sales.inTransitUnits * deliveryRate;
  return {
    spend,
    orders: sales.orders,
    confirmed: sales.confirmed,
    delivered: sales.delivered,
    inTransit: sales.inTransit,
    units: sales.units,
    deliveredUnits: sales.deliveredUnits,
    revenue,
    gain,
    maximum,
    costOrder: ratio(spend, sales.orders),
    costConfirmed: ratio(spend, sales.confirmed),
    costSale: ratio(spend, sales.delivered),
    costUnit: ratio(spend, sales.deliveredUnits),
    projectedSales,
    projectedCost: ratio(spend, projectedSales),
    projectedGain,
    roas: ratio(revenue, spend),
    projectedRoas: ratio(projectedRevenue, spend),
    ticket,
    gainUnit: ratio(gain, sales.deliveredUnits),
    missingCosts: sales.missingCostOrders,
    attributed: sales.attributedOrders,
    projectedUnits,
    usage: profitUsage(ratio(spend, projectedSales), maximum),
  };
}
export function deliveryRate(data: AdsSales, storeId: string) {
  const rows = data.deliveryHistory.filter((row) => storeId === "all" || row.storeId === storeId);
  if (!rows.length || rows.some((row) => row.deliveryRate === null)) return null;
  if (rows.length === 1) return rows[0].deliveryRate;
  const weighted = rows as Array<{ deliveryRate: number; closedConfirmed?: number }>;
  const denominator = weighted.reduce((sum, row) => sum + (row.closedConfirmed ?? 0), 0);
  return denominator > 0
    ? weighted.reduce((sum, row) => sum + row.deliveryRate * (row.closedConfirmed ?? 0), 0) /
        denominator
    : null;
}
export function cohortFinancial(
  spend: number | null,
  groups: SalesGroup[],
  sales: AdsSales,
): Financial {
  const total = financial(spend, sumSales(groups), null);
  const ids = [...new Set(groups.map((row) => row.storeId).filter((id): id is string => !!id))];
  const pieces = ids.map((id) =>
    financial(0, sumSales(groups.filter((row) => row.storeId === id)), deliveryRate(sales, id)),
  );
  const sum = (key: "projectedSales" | "projectedUnits" | "projectedGain") =>
    pieces.some((row) => row[key] === null)
      ? null
      : pieces.reduce((value, row) => value + (row[key] ?? 0), 0);
  const projectedSales = sum("projectedSales");
  const projectedUnits = sum("projectedUnits");
  const contribution = sum("projectedGain");
  const projectedGain = contribution === null || spend === null ? null : contribution - spend;
  const projectedRevenue = ids.reduce<number | null>((value, id) => {
    if (value === null) return null;
    const group = sumSales(groups.filter((row) => row.storeId === id));
    const rate = deliveryRate(sales, id);
    const revenue = numeric(group.billedRevenue);
    const transit = numeric(group.inTransitRevenue);
    return revenue === null ||
      (group.inTransit > 0 && transit !== 0 && (rate === null || transit === null))
      ? null
      : value + revenue + (group.inTransit > 0 ? (rate ?? 0) * (transit ?? 0) : 0);
  }, 0);
  return {
    ...total,
    projectedSales,
    projectedUnits,
    projectedCost: ratio(spend, projectedSales),
    projectedGain,
    projectedRoas: ratio(projectedRevenue, spend),
    usage: profitUsage(ratio(spend, projectedSales), total.maximum),
  };
}
export function summarize(summary: AdsSummary, sales: AdsSales, storeId: string, channel = "all") {
  return cohortFinancial(
    !summarySpendAvailable(summary) ? null : sumSpend(spendRows(summary, storeId, channel)),
    paidRows(sales.byChannel, storeId, channel),
    sales,
  );
}
export function productFinancialRows(
  summary: AdsSummary,
  sales: AdsSales,
  products: AdsProduct[],
  storeId: string,
) {
  const productIds = [
    ...new Set([
      ...sales.byProduct.map((row) => row.productId).filter((id): id is string => !!id),
      ...summary.adProducts
        .map((row) => row.productId)
        .filter((id): id is string => !!id && id !== "varios"),
    ]),
  ];
  return productIds.flatMap((productId) => {
    const assignments = summary.adProducts.filter((row) => row.productId === productId);
    const relevantStoreIds = [
      ...new Set(
        [
          ...sales.byProduct.filter((row) => row.productId === productId).map((row) => row.storeId),
          ...assignments.map((row) => row.storeId),
        ].filter((id): id is string => !!id),
      ),
    ];
    return relevantStoreIds
      .filter((id) => storeId === "all" || id === storeId)
      .map((id) => {
        const records = sales.byProduct.filter(
          (row) => row.productId === productId && row.storeId === id,
        );
        const ads = assignments.filter((row) => row.storeId === id);
        const ids = new Set(ads.map((row) => row.adId));
        const productSales = sumSales(records);
        const value = financial(
          !summarySpendAvailable(summary)
            ? null
            : sumSpend(
                summary.days.filter(
                  (row) => row.storeId === id && ids.has(row.adId) && row.currency === "PEN",
                ),
              ),
          productSales,
          deliveryRate(sales, id),
        );
        const product = products.find((row) => row.id === productId);
        return {
          productId,
          storeId: id,
          name: product?.name ?? "Producto sin nombre",
          ads: ads.length,
          netUnitPrice: ratio(
            numeric(productSales.billedRevenue),
            productSales.billedUnits ?? null,
          ),
          costWithShipping:
            value.missingCosts ||
            numeric(productSales.eligibleProductCost) === null ||
            numeric(productSales.eligibleShippingCost) === null
              ? null
              : ratio(
                  numeric(productSales.eligibleProductCost)! +
                    numeric(productSales.eligibleShippingCost)!,
                  productSales.eligibleBilledUnits ?? null,
                ),
          ...value,
        };
      });
  });
}
export function trafficLight(usage: number | null, threshold = 70) {
  return usage === null
    ? { label: "Sin costo suficiente", className: "text-muted-foreground", color: "#94a3b8" }
    : usage > 1
      ? { label: "Pierdes plata", className: "text-red-600", color: "#ef4444" }
      : usage >= threshold / 100
        ? { label: "Cerca del límite", className: "text-amber-600", color: "#f59e0b" }
        : { label: "Rentable", className: "text-emerald-600", color: "#10b981" };
}
export function monthlyModel(summary: AdsSummary, sales: AdsSales, storeId: string, month: string) {
  const from = `${month}-01`;
  const to = dayKey(endOfMonth(parseISO(from)));
  const today = summary.today;
  const through = to < today ? to : today;
  const dates = dateRange(from, to);
  const days = dates.map((date) => {
    const groups = paidRows(sales.daily, storeId).filter((row) => row.date === date);
    return {
      date,
      future: date > through,
      week: dayKey(startOfWeek(parseISO(date), { weekStartsOn: 1 })),
      ...cohortFinancial(
        !summarySpendAvailable(summary)
          ? null
          : sumSpend(spendRows(summary, storeId).filter((row) => row.date === date)),
        groups,
        sales,
      ),
    };
  });
  const elapsed = days.filter((row) => !row.future);
  const closedCalendarDays = elapsed.filter((row) => row.date < today);
  const total = summarize(summary, sales, storeId);
  const spentBeforeToday = closedCalendarDays.reduce((sum, row) => sum + (row.spend ?? 0), 0);
  const dailyAverage =
    closedCalendarDays.length && closedCalendarDays.every((row) => row.spend !== null)
      ? spentBeforeToday / closedCalendarDays.length
      : null;
  const remaining = days.filter((row) => row.future).length;
  const budgetRows = summary.settings.budgets.filter(
    (row) => row.month === month && (storeId === "all" || row.storeId === storeId),
  );
  const budget = budgetRows.length
    ? budgetRows.reduce((sum, row) => sum + (numeric(row.amount) ?? 0), 0)
    : null;
  const forecast =
    remaining === 0
      ? total.spend
      : total.spend === null || dailyAverage === null
        ? null
        : total.spend + dailyAverage * remaining;
  const closedSalesDays = elapsed.filter((row) => row.date < today && row.inTransit === 0);
  const profitableDays = closedSalesDays.filter((row) => row.gain !== null && row.gain >= 0).length;
  const sorted = elapsed
    .filter((row) => row.projectedGain !== null)
    .sort((a, b) => (b.projectedGain ?? 0) - (a.projectedGain ?? 0));
  let cumulativeSpend: number | null = 0;
  let cumulativeGain: number | null = 0;
  const dailyGain =
    closedCalendarDays.length && closedCalendarDays.every((row) => row.projectedGain !== null)
      ? closedCalendarDays.reduce((sum, row) => sum + (row.projectedGain ?? 0), 0) /
        closedCalendarDays.length
      : null;
  const calendarDays = days.map((row, index) => {
    if (!row.future) {
      cumulativeSpend =
        row.spend === null || cumulativeSpend === null ? null : cumulativeSpend + row.spend;
      cumulativeGain =
        row.projectedGain === null || cumulativeGain === null
          ? null
          : cumulativeGain + row.projectedGain;
    }
    return {
      ...row,
      cumulativeSpend,
      cumulativeGain,
      ideal: budget === null ? null : (budget / days.length) * (index + 1),
      futureSpend: budget === null ? null : budget / days.length,
    };
  });
  const weeks = [...new Set(elapsed.map((row) => row.week))].map((week) => {
    const rows = calendarDays.filter((row) => !row.future && row.week === week);
    const dates = new Set(rows.map((row) => row.date));
    const spend = rows.some((row) => row.spend === null)
      ? null
      : rows.reduce((value, row) => value + (row.spend ?? 0), 0);
    return {
      week,
      rows,
      ...cohortFinancial(
        spend,
        paidRows(sales.daily, storeId).filter((row) => dates.has(row.date ?? "")),
        sales,
      ),
      cumulativeSpend: rows.at(-1)?.cumulativeSpend ?? null,
      cumulativeGain: rows.at(-1)?.cumulativeGain ?? null,
    };
  });
  return {
    from,
    to,
    today,
    days: calendarDays,
    weeks,
    total,
    budget,
    forecast,
    gainForecast:
      total.projectedGain === null || dailyGain === null
        ? null
        : total.projectedGain + dailyGain * remaining,
    remaining,
    dailyAverage,
    idealToDate: budget === null ? null : (budget / days.length) * elapsed.length,
    maximumDaily:
      budget === null || total.spend === null || remaining === 0
        ? null
        : Math.max(0, (budget - total.spend) / remaining),
    profitableDays,
    closedDays: closedSalesDays.length,
    best: sorted[0]?.date,
    worst: sorted.at(-1)?.date,
  };
}
export function adAge(row: AdsRow, _today: string) {
  // Calendar age includes paused days and cannot establish actual delivery days.
  return row.daysActive ?? null;
}
export function resultCount(row: AdsRow, channel: string) {
  return numeric(
    row.insights.resultMetrics?.[channel === "web" ? "webPurchases" : "messages"]?.count,
  );
}
export function rowResultTotal(row: AdsRow, channels: Iterable<string>): number | null {
  const kinds = [...new Set(channels)];
  if (!kinds.length || kinds.some((channel) => channel !== "messages" && channel !== "web"))
    return null;
  const counts = kinds.map((channel) => resultCount(row, channel));
  return counts.some((count) => count === null)
    ? null
    : counts.reduce<number>((sum, count) => sum + count!, 0);
}
export function daysForRow(row: AdsRow, summary: AdsSummary) {
  return summary.days.filter(
    (day) =>
      day.currency === row.currency &&
      (!row.accountId || row.level === "store" || day.accountId === row.accountId) &&
      (row.level === "ad"
        ? day.adId === row.id
        : row.level === "adset"
          ? day.adsetId === row.id
          : row.level === "campaign"
            ? day.campaignId === row.id
            : row.level === "account"
              ? day.accountId === row.id
              : day.storeId === row.id),
  );
}
export function channelData(
  summary: AdsSummary,
  sales: AdsSales,
  channel: string,
  storeId = "all",
) {
  if (channel === "all" && storeId === "all") return { summary, sales };
  const matches = (row: { storeId?: string | null; channel?: string }) =>
    (channel === "all" || row.channel === channel) &&
    (storeId === "all" || (storeId === "none" ? !row.storeId : row.storeId === storeId));
  const byChannel = sales.byChannel.filter(matches);
  return {
    summary: { ...summary, days: summary.days.filter(matches) },
    sales: {
      ...sales,
      globalAttributedOrders:
        (sales as AdsSales & { globalAttributedOrders?: number }).globalAttributedOrders ??
        sales.totals.attributedOrders,
      byChannel,
      byAd: sales.byAd.filter(matches),
      daily: sales.daily.filter(matches),
      totals: sumSales(byChannel.filter((row) => row.channel !== "other")),
    },
  };
}
export function channelRow(row: AdsRow, summary: AdsSummary, channel: string): AdsRow {
  if (channel === "all") return row;
  const all = daysForRow(row, summary);
  const selected = all.filter((day) => day.channel === channel);
  const total = (key: "impressions" | "linkClicks") =>
    selected.some((day) => day[key] === null)
      ? null
      : selected.reduce((sum, day) => sum + Number(day[key]), 0);
  const impressions = total("impressions");
  const clicks = total("linkClicks");
  const results = selected.some((day) => day.results === null)
    ? null
    : selected.reduce((sum, day) => sum + (day.results ?? 0), 0);
  const spend = !summarySpendAvailable(summary) ? null : sumSpend(selected);
  const partial = all.some((day) => day.channel !== channel);
  const type = channel === "web" ? "webPurchases" : "messages";
  return {
    ...row,
    insights: {
      ...row.insights,
      spend: spend === null ? null : String(spend),
      impressions: impressions === null ? null : String(impressions),
      inlineLinkClicks: clicks === null ? null : String(clicks),
      ctr: ratio(clicks, impressions) === null ? null : String(ratio(clicks, impressions)! * 100),
      frequency: partial ? null : row.insights.frequency,
      reach: partial ? null : row.insights.reach,
      resultMetrics: {
        messages: row.insights.resultMetrics?.messages ?? {
          count: null,
          costPerResult: null,
          status: "unknown",
        },
        webPurchases: row.insights.resultMetrics?.webPurchases ?? {
          count: null,
          costPerResult: null,
          status: "unknown",
        },
        [type]: {
          count: results === null ? null : String(results),
          costPerResult: ratio(spend, results) === null ? null : String(ratio(spend, results)),
          status: results === null ? "unknown" : "complete",
        },
      },
    },
  };
}
const leafKey = (accountId: string, adId: string) => JSON.stringify([accountId, adId]);
const segmentKey = (storeId: string | null | undefined, channel: string | undefined) =>
  JSON.stringify([storeId ?? null, channel ?? "other"]);
const addIndex = <T>(index: Map<string, T[]>, key: string, value: T) => {
  const rows = index.get(key);
  if (rows) rows.push(value);
  else index.set(key, [value]);
};
function costEvidence(metric: SalesMetric) {
  const units = metric.billedUnits ?? metric.deliveredUnits;
  const eligible =
    metric.eligibleBilledUnits ??
    metric.eligibleDeliveredUnits ??
    (metric.missingCostOrders === 0 ? units : 0);
  const amounts = [
    metric.eligibleRevenue,
    metric.eligibleProductCost,
    metric.eligibleShippingCost,
  ].map(numeric);
  const known =
    amounts.every((amount) => amount !== null) &&
    (eligible > 0 ||
      (units === 0 && numeric(metric.billedRevenue) === 0 && metric.missingCostOrders === 0));
  return {
    units,
    eligible,
    coverage:
      units > 0
        ? Math.min(1, eligible / units)
        : metric.missingCostOrders > 0 || numeric(metric.billedRevenue) !== 0
          ? 0
          : 1,
    contribution: known ? amounts[0]! - amounts[1]! - amounts[2]! : null,
  };
}
export function financialBasis(value: Financial) {
  const evidence = value.evidence;
  if (!evidence) return "Ventas POWIP";
  return evidence.basis === "estimated"
    ? "Estimado por canal"
    : evidence.attributionCoverage !== 1 || evidence.issues.includes("attribution")
      ? "Medido parcial"
      : "Medido por anuncio";
}
export function financialCauses(value: Financial, includeCosts = true) {
  const messages: Partial<Record<FinancialIssue, string>> = {
    attribution:
      "Este anuncio aún no tiene ventas identificadas; no se interpreta como cero ventas.",
    store: "Asigna la tienda para conectar las ventas de POWIP.",
    channel: "Falta identificar si las ventas corresponden a Web o Mensajes.",
    results: "Faltan resultados de Meta del mismo período para repartir las ventas.",
    product: "Vincula el producto del anuncio para usar sus ingresos y costos.",
    spend: "Falta confirmar el gasto de Meta para calcular ROAS y ganancia.",
    currency: "El gasto y las ventas tienen monedas distintas.",
    ...(includeCosts
      ? {
          "historical-cost": "Faltan costos históricos de producto o envío en las ventas.",
          "partial-cost": "Ganancia con costos registrados; faltan costos en parte de las ventas.",
        }
      : {}),
  };
  return (value.evidence?.issues ?? []).flatMap((issue) =>
    messages[issue] ? [messages[issue]!] : [],
  );
}
/** Build indexes once for the catalog; server pages and the complete export keep the same scope. */
export function createAdFinancialCalculator(summary: AdsSummary, sales: AdsSales) {
  const dayIndex = new Map<string, AdsDay[]>();
  const segmentDays = new Map<string, AdsDay[]>();
  const accountsByAd = new Map<string, Set<string>>();
  const assignment = new Map(
    summary.adProducts.map((item) => [leafKey(item.accountId, item.adId), item.productId]),
  );
  for (const day of summary.days) {
    const accounts = accountsByAd.get(day.adId) ?? new Set<string>();
    accounts.add(day.accountId);
    accountsByAd.set(day.adId, accounts);
    for (const [level, id] of [
      ["ad", day.adId],
      ["adset", day.adsetId],
      ["campaign", day.campaignId],
      ["account", day.accountId],
      ["store", day.storeId],
    ] as const) {
      if (id) addIndex(dayIndex, `${level}:${id}`, day);
    }
    addIndex(segmentDays, segmentKey(day.storeId, day.channel), day);
  }
  const channelSales = new Map<string, SalesGroup[]>();
  const productSales = new Map<string, SalesGroup[]>();
  for (const group of sales.byChannel)
    addIndex(channelSales, segmentKey(group.storeId, group.channel), group);
  for (const group of sales.byProduct ?? []) {
    if (group.productId && group.channel && group.channel !== "other")
      addIndex(
        productSales,
        `${segmentKey(group.storeId, group.channel)}:${group.productId}`,
        group,
      );
  }
  const pools = new Map([...channelSales].map(([key, rows]) => [key, sumSales(rows)]));
  const products = new Map([...productSales].map(([key, rows]) => [key, sumSales(rows)]));
  const salesByLeaf = new Map<string, SalesGroup[]>();
  const legacySalesByAd = new Map<string, SalesGroup[]>();
  for (const group of sales.byAd) {
    if (!group.adId) continue;
    if (group.accountId) addIndex(salesByLeaf, leafKey(group.accountId, group.adId), group);
    else addIndex(legacySalesByAd, group.adId, group);
  }
  const attribution =
    (sales as AdsSales & { globalAttributedOrders?: number }).globalAttributedOrders ??
    sales.totals.attributedOrders;
  const resultPools = new Map(
    [...segmentDays].map(([key, days]) => {
      const productResults = new Map<string, number>();
      let total = 0;
      let complete = true;
      for (const day of days) {
        if (day.results === null || !Number.isFinite(day.results)) complete = false;
        else {
          total += day.results;
          const id = assignment.get(leafKey(day.accountId, day.adId));
          if (id && id !== "varios")
            productResults.set(id, (productResults.get(id) ?? 0) + day.results);
        }
      }
      const hasProductPool = [...productResults.keys()].some((id) => products.has(`${key}:${id}`));
      return [key, { total, complete, productResults, hasProductPool }] as const;
    }),
  );
  return (row: AdsRow): Financial => {
    const raw = (dayIndex.get(`${row.level}:${row.id}`) ?? []).filter(
      (day) =>
        day.currency === row.currency &&
        (!row.accountId || row.level === "store" || row.accountId === day.accountId),
    );
    const ids = new Set(raw.map((day) => leafKey(day.accountId, day.adId)));
    if (row.level === "ad") ids.add(leafKey(row.accountId, row.id));
    const ownSpendConfirmed =
      row.level === "store" ? undefined : row.insights.coverage?.spendAvailable;
    const spend =
      (ownSpendConfirmed ?? summarySpendAvailable(summary)) ? numeric(row.insights.spend) : null;
    const issues = new Set<FinancialIssue>();
    if (spend === null) issues.add("spend");
    if (row.currency !== "PEN") issues.add("currency");
    const scopeSegments = new Set(raw.map((day) => segmentKey(day.storeId, day.channel)));
    const scopeRows = sales.byChannel.filter(
      (group) =>
        group.channel !== "other" &&
        (scopeSegments.size
          ? scopeSegments.has(segmentKey(group.storeId, group.channel))
          : !row.store?.id || row.store.id === group.storeId),
    );
    const scope = sumSales(scopeRows);
    const coverage = ratio(scope.attributedOrders, scope.orders);
    if (attribution > 0) {
      const ownRows = [
        ...new Set(
          [...ids].flatMap((id) => {
            const [accountId, adId] = JSON.parse(id) as [string, string];
            const accounts = accountsByAd.get(adId);
            const legacy = legacySalesByAd.get(adId) ?? [];
            const uniqueAccount = accounts?.size === 1 && accounts.has(accountId);
            if (legacy.length > 0 && !uniqueAccount) issues.add("attribution");
            return [...(salesByLeaf.get(id) ?? []), ...(uniqueAccount ? legacy : [])];
          }),
        ),
      ].filter((group) => row.level !== "store" || group.storeId === row.id);
      const own = sumSales(ownRows);
      const costs = costEvidence(own);
      const value = cohortFinancial(spend, ownRows, sales);
      const hasOrders = ownRows.length > 0 && own.orders > 0;
      if (!hasOrders) issues.add("attribution");
      if (hasOrders && costs.contribution === null) issues.add("historical-cost");
      else if (hasOrders && costs.coverage < 1) issues.add("partial-cost");
      return comparableCurrency(row, {
        ...value,
        ...(!hasOrders
          ? {
              revenue: null,
              gain: null,
              roas: null,
              maximum: null,
              projectedGain: null,
              projectedRoas: null,
            }
          : {}),
        evidence: {
          basis: "measured",
          partial:
            !hasOrders ||
            coverage === null ||
            coverage < 1 ||
            costs.coverage < 1 ||
            issues.size > 0,
          attributionCoverage: coverage,
          costCoverage: hasOrders ? costs.coverage : null,
          issues: [...issues],
        },
      });
    }
    if (!raw.length || raw.some((day) => !day.storeId)) issues.add("store");
    if (!summarySpendAvailable(summary)) issues.add("results");
    if (raw.some((day) => day.channel === "other")) issues.add("channel");
    const leafSegments = new Map<string, AdsDay[]>();
    for (const day of raw)
      addIndex(
        leafSegments,
        JSON.stringify([day.accountId, day.adId, day.storeId, day.channel]),
        day,
      );
    let delivered = 0,
      deliveredUnits = 0,
      revenue = 0,
      contribution = 0,
      eligibleSales = 0;
    let coveredUnits = 0,
      billedUnits = 0,
      missingCosts = 0;
    let revenueKnown = !issues.has("store") && !issues.has("channel") && !issues.has("results");
    let contributionKnown = revenueKnown;
    let hasKnownCost = false;
    for (const days of leafSegments.values()) {
      const first = days[0];
      if (!first.storeId || first.channel === "other") continue;
      const key = segmentKey(first.storeId, first.channel);
      const results = resultPools.get(key)!;
      const cohort = pools.get(key) ?? emptySales();
      if (!results.complete || days.some((day) => day.results === null)) {
        issues.add("results");
        revenueKnown = contributionKnown = false;
        continue;
      }
      const ownResults = days.reduce((sum, day) => sum + day.results!, 0);
      const share = results.total > 0 ? ownResults / results.total : 0;
      delivered += share * cohort.delivered;
      const productId = assignment.get(leafKey(first.accountId, first.adId));
      let pool = cohort;
      let poolShare = share;
      if (productId && productId !== "varios") {
        const ownProduct = products.get(`${key}:${productId}`);
        const denominator = results.productResults.get(productId) ?? 0;
        if (!ownProduct || denominator <= 0) {
          issues.add(ownProduct ? "results" : "product");
          revenueKnown = contributionKnown = false;
          continue;
        }
        pool = ownProduct;
        poolShare = ownResults / denominator;
      } else if (results.hasProductPool) {
        issues.add("product");
        revenueKnown = contributionKnown = false;
        continue;
      }
      const net = numeric(pool.billedRevenue);
      if (net === null) {
        issues.add("product");
        revenueKnown = false;
      } else revenue += poolShare * net;
      deliveredUnits += poolShare * pool.deliveredUnits;
      const costs = costEvidence(pool);
      coveredUnits += poolShare * costs.eligible;
      billedUnits += poolShare * costs.units;
      eligibleSales += share * cohort.delivered * costs.coverage;
      missingCosts += poolShare * pool.missingCostOrders;
      if (costs.contribution === null) {
        issues.add("historical-cost");
      } else {
        hasKnownCost = true;
        contribution += poolShare * costs.contribution;
      }
      if (costs.coverage < 1 && costs.contribution !== null) issues.add("partial-cost");
    }
    const baseline = financial(spend, emptySales(), null);
    if (hasKnownCost && issues.has("historical-cost")) {
      issues.delete("historical-cost");
      issues.add("partial-cost");
    }
    const maximum = contributionKnown && hasKnownCost ? ratio(contribution, eligibleSales) : null;
    const gain = contributionKnown && hasKnownCost && spend !== null ? contribution - spend : null;
    const costCoverage =
      billedUnits > 0
        ? Math.min(1, coveredUnits / billedUnits)
        : issues.has("historical-cost")
          ? 0
          : 1;
    return comparableCurrency(row, {
      ...baseline,
      delivered,
      deliveredUnits,
      missingCosts,
      revenue: revenueKnown ? revenue : null,
      gain,
      maximum,
      costSale: ratio(spend, delivered),
      costUnit: ratio(spend, deliveredUnits),
      roas: revenueKnown ? ratio(revenue, spend) : null,
      ticket: revenueKnown ? ratio(revenue, delivered) : null,
      gainUnit: ratio(gain, deliveredUnits),
      usage: profitUsage(ratio(spend, delivered), maximum),
      projectedGain: null,
      projectedRoas: null,
      projectedSales: null,
      projectedUnits: null,
      projectedCost: null,
      evidence: {
        basis: "estimated",
        partial: issues.size > 0 || costCoverage < 1,
        attributionCoverage: coverage,
        costCoverage,
        issues: [...issues],
      },
    });
  };
}
export function adFinancial(
  row: AdsRow,
  summary: AdsSummary,
  sales: AdsSales,
  product?: AdsProduct,
) {
  const value = createAdFinancialCalculator(summary, sales)(row);
  const linked = summary.adProducts.some(
    (item) =>
      item.adId === row.id && item.accountId === row.accountId && item.productId === product?.id,
  );
  if (product && row.level === "ad" && !linked && value.evidence?.basis === "estimated") {
    return {
      ...value,
      revenue: null,
      gain: null,
      roas: null,
      maximum: null,
      ticket: null,
      gainUnit: null,
      usage: null,
      evidence: {
        ...value.evidence,
        partial: true,
        issues: [...new Set<FinancialIssue>([...value.evidence.issues, "product"])],
      },
    };
  }
  return value;
}
function comparableCurrency(row: AdsRow, value: Financial): Financial {
  return row.currency === "PEN"
    ? value
    : {
        ...value,
        gain: null,
        maximum: null,
        roas: null,
        projectedGain: null,
        projectedRoas: null,
        gainUnit: null,
        usage: null,
      };
}
export function creativeMetrics(row: AdsRow) {
  const impressions = numeric(row.insights.impressions);
  const video3s =
    numeric(row.insights.video3s) ??
    numeric(row.insights.actions?.find((action) => action.actionType === "video_view")?.value);
  const thruplay = numeric(row.insights.thruplay ?? row.insights.videoThruplay);
  const clicks = numeric(row.insights.inlineLinkClicks);
  const results =
    numeric(row.insights.results?.value) ??
    resultCount(
      row,
      row.destinationType === "WEBSITE" ||
        (!row.destinationType && row.objective?.includes("SALES"))
        ? "web"
        : "messages",
    );
  return {
    impressions,
    clicks,
    hook: ratio(video3s, impressions),
    hold: ratio(thruplay, video3s),
    ctr: numeric(row.insights.ctr),
    conversion:
      row.insights.conversionRate != null
        ? row.insights.conversionRate / 100
        : ratio(results, clicks),
    video3s,
    thruplay,
  };
}
export function creativeAverage(rows: AdsRow[]) {
  const pairs = rows.map(creativeMetrics);
  const weighted = (
    key: "hook" | "hold" | "ctr" | "conversion",
    denominator: "impressions" | "clicks",
  ) => {
    const valid = pairs.filter((row) => row[key] !== null && row[denominator] !== null);
    const total = valid.reduce((sum, row) => sum + (row[denominator] ?? 0), 0);
    return total
      ? valid.reduce((sum, row) => sum + (row[key] ?? 0) * (row[denominator] ?? 0), 0) / total
      : null;
  };
  return {
    hook: weighted("hook", "impressions"),
    hold: weighted("hold", "impressions"),
    ctr: weighted("ctr", "impressions"),
    conversion: weighted("conversion", "clicks"),
  };
}
export function diagnosis(
  row: AdsRow,
  average: ReturnType<typeof creativeAverage>,
  channelAverage: number | null = average.conversion,
  highFrequency = 3.5,
) {
  const metric = creativeMetrics(row);
  const video = row.creative?.format?.toLowerCase().includes("video");
  const ample = (metric.impressions ?? 0) >= 1000;
  if (
    video &&
    ample &&
    metric.hook !== null &&
    average.hook !== null &&
    metric.hook < average.hook * 0.8
  )
    return { label: "Gancho débil: cambia los primeros 3 s", suggested: "media" };
  if (
    video &&
    ample &&
    metric.hold !== null &&
    average.hold !== null &&
    metric.hold < average.hold * 0.8
  )
    return { label: "Se van en el medio: acorta y muestra el producto antes", suggested: "media" };
  if (ample && metric.ctr !== null && average.ctr !== null && metric.ctr < average.ctr * 0.8)
    return { label: "No da ganas de hacer clic: revisa el cierre y la oferta", suggested: "text" };
  if (
    (metric.clicks ?? 0) >= 30 &&
    metric.conversion !== null &&
    channelAverage !== null &&
    metric.conversion < channelAverage * 0.7
  )
    return { label: "Se pierde después del clic: revisa chat o web y precio", suggested: "brief" };
  if ((numeric(row.insights.frequency) ?? 0) >= highFrequency || (row.ctrDecline ?? 0) >= 0.25)
    return { label: "Se está cansando: prueba otro gancho o formato", suggested: "media" };
  if (!ample) return { label: "Poca data para diagnosticar", suggested: "brief" };
  return { label: "Funciona: haz variaciones del gancho", suggested: "media" };
}
export function isMetaPaused(row: Pick<AdsRow, "effectiveStatus" | "status">) {
  return (
    ["PAUSED", "ADSET_PAUSED", "CAMPAIGN_PAUSED"].includes(row.effectiveStatus ?? "") ||
    row.status === "PAUSED"
  );
}
export function metaPauseDescription(row: AdsRow) {
  if (row.effectiveStatus === "CAMPAIGN_PAUSED") return "La campaña está pausada.";
  if (row.effectiveStatus === "ADSET_PAUSED") return "El conjunto está pausado.";
  return "No está gastando.";
}
export function metaStatusLabel(row: Pick<AdsRow, "effectiveStatus" | "status">) {
  if (row.effectiveStatus === "CAMPAIGN_PAUSED") return "Pausado por la campaña";
  if (row.effectiveStatus === "ADSET_PAUSED") return "Pausado por el conjunto";
  if (isMetaPaused(row)) return "Pausado";
  const labels: Record<string, string> = {
    ACTIVE: "Activo",
    IN_PROCESS: "En proceso",
    PENDING_REVIEW: "En revisión",
    PREAPPROVED: "Aprobado",
    DISAPPROVED: "No aprobado",
    WITH_ISSUES: "Con incidencias",
    PENDING_BILLING_INFO: "Pendiente de información de pago",
    ARCHIVED: "Archivado",
    DELETED: "Eliminado",
  };
  return labels[row.effectiveStatus ?? row.status ?? ""] ?? "Estado no disponible";
}
export function adStatus(
  row: AdsRow,
  values: Financial,
  rules: AdsRules,
  today: string,
  results: number | null,
) {
  const age = adAge(row, today);
  if (isMetaPaused(row)) return "Pausado";
  if (age !== null && age < rules.noResultsDays) return "Aprendizaje";
  if (values.evidence?.partial) return "Sin datos suficientes";
  if (
    age !== null &&
    age >= rules.noResultsDays &&
    (values.spend ?? 0) >= Number(rules.minSpend) &&
    results === 0 &&
    values.delivered === 0
  )
    return "Sin resultados";
  if (values.costSale === null || values.maximum === null) return "Sin datos suficientes";
  if (values.costSale > values.maximum) return "Pierdes plata";
  return trafficLight(profitUsage(values.costSale, values.maximum), rules.nearLimitPct).label;
}
export function canScale(row: AdsRow, values: Financial, rules: AdsRules, today: string) {
  const frequency = numeric(row.insights.frequency);
  const age = adAge(row, today);
  const lastIncrease = row.budget?.increasedAt;
  const elapsed = lastIncrease
    ? (parseISO(today).getTime() - parseISO(lastIncrease).getTime()) / 86_400_000
    : null;
  return (
    adStatus(row, values, rules, today, resultCount(row, "messages")) === "Rentable" &&
    (ratio(values.costSale, values.maximum) ?? 1) < 0.5 &&
    age !== null &&
    age >= 5 &&
    frequency !== null &&
    frequency < 2.5 &&
    row.recentCostStable === true &&
    (row.budget?.noRecentIncrease === true ||
      (elapsed !== null && elapsed >= 3 && row.budget?.historyComplete === true)) &&
    row.stockDays !== null &&
    row.stockDays !== undefined &&
    row.stockDays > 10
  );
}
