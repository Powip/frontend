import { endOfMonth, format, parseISO, startOfWeek } from "date-fns";
import type {
  AdsSalesV23,
  AdsSummaryV23,
  AdsDayV23,
  SalesRowV23,
  SalesMetricV23,
  CodLeadRowV23,
} from "@/services/advertisingV23Service";
import { dateRange, numeric, ratio, summarySpendAvailable } from "./model";

export const countKeys = [
  "orders",
  "units",
  "confirmed",
  "delivered",
  "inTransit",
  "deliveredUnits",
  "inTransitUnits",
  "cancelled",
  "attributedOrders",
  "normalOrders",
  "normalConfirmed",
  "convertedCodOrders",
  "unattributedOrders",
  "missingSellerOrders",
  "eligibleDelivered",
  "eligibleDeliveredUnits",
  "billedUnits",
  "eligibleBilledUnits",
  "missingCostOrders",
  "completeCostOrders",
  "adjustmentOrders",
  "unknownAdjustmentAmounts",
  "ordersNet",
] as const;
export const amountKeys = [
  "billedRevenue",
  "orderRevenue",
  "deliveredRevenue",
  "inTransitRevenue",
  "productCost",
  "shippingCost",
  "eligibleRevenue",
  "eligibleProductCost",
  "eligibleShippingCost",
  "inTransitProductCost",
  "inTransitShippingCost",
  "adjustmentRevenue",
  "orderRevenueNet",
] as const;
export function totalV23(rows: SalesRowV23[]): SalesMetricV23 {
  const result: Record<string, unknown> = {};
  for (const key of countKeys)
    result[key] = rows.reduce((sum, row) => sum + (numeric(row[key]) ?? 0), 0);
  for (const key of amountKeys)
    result[key] = rows.some((row) => row[key] === null)
      ? null
      : rows.reduce((sum, row) => sum + (numeric(row[key]) ?? 0), 0).toFixed(6);
  return result as unknown as SalesMetricV23;
}
const poolKey = (row: Pick<SalesRowV23, "storeId" | "channel">) =>
  `${row.storeId ?? "none"}:${exactSalesChannel(row.channel) === "shopify" ? "web" : exactSalesChannel(row.channel)}`;
function scaleRow<T extends SalesRowV23>(row: T, share: number): T {
  const result = { ...row };
  for (const key of countKeys)
    (result as Record<string, unknown>)[key] = (numeric(row[key]) ?? 0) * share;
  for (const key of amountKeys)
    (result as Record<string, unknown>)[key] =
      row[key] === null ? null : String((numeric(row[key]) ?? 0) * share);
  return result;
}
/** Keep exact IDs, then distribute only the unmeasured residual within the same store and family. */
export function allocateV23Sales<T extends SalesRowV23>(
  rows: T[],
  summary: AdsSummaryV23,
  basisRows: SalesRowV23[] = rows,
): T[] {
  const pools = new Map<string, Map<string, number>>();
  const incomplete = new Set<string>();
  for (const day of summary.days) {
    if (!day.channelExact) continue;
    const key = `${day.storeId ?? "none"}:${day.channelExact}`;
    if (day.results === null) incomplete.add(key);
    if (!pools.has(key)) pools.set(key, new Map());
    const accounts = pools.get(key)!;
    accounts.set(day.accountId, (accounts.get(day.accountId) ?? 0) + Math.max(0, day.results ?? 0));
  }
  for (const row of basisRows)
    if (row.accountId) {
      const accounts = pools.get(poolKey(row));
      if (accounts)
        accounts.set(row.accountId, Math.max(0, (accounts.get(row.accountId) ?? 0) - row.orders));
    }
  return rows.flatMap((row) => {
    if (row.accountId) return [row];
    if (incomplete.has(poolKey(row))) return [row];
    const weights = [...(pools.get(poolKey(row)) ?? new Map<string, number>())].filter(
      ([, weight]) => weight > 0,
    );
    const denominator = weights.reduce((sum, [, weight]) => sum + weight, 0);
    if (!denominator) return [row];
    return weights.map(([accountId, weight]) => ({
      ...scaleRow(row, weight / denominator),
      accountId,
      adId: null,
      estimated: true,
    }));
  });
}
export function v23Scope(
  rows: SalesRowV23[],
  summary: AdsSummaryV23,
  storeId = "all",
  accountId = "all",
  family = "all",
  basisRows = rows,
) {
  return allocateV23Sales(rows, summary, basisRows).filter(
    (row) =>
      (storeId === "all" || row.storeId === storeId) &&
      (accountId === "all" || row.accountId === accountId) &&
      (family === "all"
        ? ["messages", "web"].includes(row.channelFamily ?? "")
        : row.channelFamily === family),
  );
}
export function scopeDays(
  summary: AdsSummaryV23,
  storeId = "all",
  accountId = "all",
  family = "all",
) {
  return summary.days.filter(
    (day) =>
      (storeId === "all" || day.storeId === storeId) &&
      (accountId === "all" || day.accountId === accountId) &&
      (family === "all" || day.channel === family),
  );
}
export function spendV23(
  summary: AdsSummaryV23,
  days: AdsDayV23[],
  storeId = "all",
  accountId = "all",
) {
  let available = summarySpendAvailable(summary, storeId);
  if (accountId !== "all" && summary.quality.accountDays) {
    const dates = dateRange(summary.from, summary.to < summary.today ? summary.to : summary.today);
    available =
      dates.length > 0 &&
      dates.every((date) =>
        summary.quality.accountDays!.some(
          (day) =>
            day.accountId === accountId &&
            day.date === date &&
            day.currency === "PEN" &&
            day.spendAvailable &&
            day.reconciliation === "matched",
        ),
      );
    if (
      storeId !== "all" &&
      summary.days.some(
        (day) => day.accountId === accountId && !day.storeId && Number(day.spend) > 0,
      )
    )
      available = false;
  }
  if (
    !summary.settings.capabilities.spend ||
    !available ||
    days.some((day) => day.currency !== "PEN" || numeric(day.spend) === null)
  )
    return null;
  return days.reduce((sum, day) => sum + Number(day.spend), 0);
}
export function v23Financial(
  rows: SalesRowV23[],
  summary: AdsSummaryV23,
  sales: AdsSalesV23,
  storeId = "all",
  accountId = "all",
  family = "all",
  days = scopeDays(summary, storeId, accountId, family),
) {
  const totals = totalV23(rows),
    spend = spendV23(summary, days, storeId, accountId);
  const deliveredRevenue = numeric(totals.deliveredRevenue),
    orderRevenue = numeric(totals.orderRevenueNet);
  let projectedDelivered = totals.delivered,
    projectedRevenue = deliveredRevenue,
    projectedMargin = 0;
  const eligibleRevenue = numeric(totals.eligibleRevenue),
    productCost = numeric(totals.eligibleProductCost),
    shippingCost = numeric(totals.eligibleShippingCost);
  const margin =
    eligibleRevenue === null || productCost === null || shippingCost === null
      ? null
      : eligibleRevenue - productCost - shippingCost;
  let projectionAvailable = true,
    projectedMarginAvailable = margin !== null;
  for (const row of rows)
    if (row.inTransit > 0) {
      const rate = sales.deliveryHistory.find((h) => h.storeId === row.storeId)?.deliveryRate;
      if (rate == null) {
        projectionAvailable = false;
        projectedMarginAvailable = false;
        continue;
      }
      projectedDelivered += row.inTransit * rate;
      const revenue = numeric(row.inTransitRevenue),
        cost = numeric(row.inTransitProductCost),
        shipping = numeric(row.inTransitShippingCost);
      if (revenue === null) projectedRevenue = null;
      else if (projectedRevenue !== null) projectedRevenue += revenue * rate;
      if (revenue === null || cost === null || shipping === null) projectedMarginAvailable = false;
      else projectedMargin += (revenue - cost - shipping) * rate;
    }
  const maximum = ratio(margin, totals.eligibleDelivered ?? totals.completeCostOrders);
  const gain = margin === null || spend === null ? null : margin - spend;
  return {
    ...totals,
    spend,
    enteredRevenue: orderRevenue,
    deliveredRevenueValue: deliveredRevenue,
    cpv: ratio(spend, totals.ordersNet),
    cpp: ratio(spend, totals.units),
    costConfirmed: ratio(spend, totals.confirmed),
    costDelivered: ratio(spend, totals.delivered),
    costDeliveredUnit: ratio(spend, totals.deliveredUnits),
    projectedDelivered: projectionAvailable ? projectedDelivered : null,
    projectedCost: projectionAvailable ? ratio(spend, projectedDelivered) : null,
    roasEntered: ratio(orderRevenue, spend),
    roasDelivered: ratio(deliveredRevenue, spend),
    projectedRoas: projectionAvailable ? ratio(projectedRevenue, spend) : null,
    maximum,
    gain,
    gainUnit: ratio(gain, totals.eligibleDeliveredUnits ?? 0),
    projectedGain:
      !projectionAvailable || !projectedMarginAvailable || spend === null
        ? null
        : margin! + projectedMargin - spend,
    ticket: ratio(deliveredRevenue, totals.delivered),
    ticketUnit: ratio(deliveredRevenue, totals.deliveredUnits),
    confirmationRate: ratio(totals.normalConfirmed, totals.normalOrders),
    deliveryRate: ratio(totals.delivered, totals.confirmed),
    rejectedRate: ratio(
      Math.max(0, totals.confirmed - totals.delivered - totals.inTransit),
      totals.confirmed,
    ),
    estimated: rows.some((row) => row.estimated),
    unallocatedOrders: rows
      .filter((row) => !row.accountId)
      .reduce((sum, row) => sum + row.orders, 0),
  };
}
export type V23Financial = ReturnType<typeof v23Financial>;
export const exactSalesChannel = (channel?: string) =>
  ({
    WHATSAPP: "wa",
    INSTAGRAM: "ig",
    FACEBOOK: "messenger",
    MESSENGER: "messenger",
    WEB: "web",
    SHOPIFY: "shopify",
    TIENDA_ONLINE: "web",
    ECOMMERCE: "web",
    SHOPIFY_COD: "shopify_cod",
  })[channel?.toUpperCase() ?? ""] ?? "other";
export const channelName = (channel: string) =>
  ({
    wa: "WhatsApp",
    ig: "Instagram",
    messenger: "Messenger",
    web: "Web",
    shopify: "Shopify",
    shopify_cod: "Shopify COD · Leads",
    other: "Otros canales",
    unassigned: "Sin canal asignado",
  })[channel] ?? channel;
export interface V23Breakdown {
  id: string;
  name: string;
  rows: SalesRowV23[];
  days: AdsDayV23[];
  leads: number;
  estimated: boolean;
}
function leadAccountShare(lead: CodLeadRowV23, days: AdsDayV23[], accountId: string) {
  if (accountId === "all") return 1;
  if (lead.accountId) return lead.accountId === accountId ? 1 : 0;
  const pool = days.filter(
    (day) => day.storeId === lead.storeId && day.channelExact === "shopify_cod",
  );
  if (pool.some((day) => day.results === null)) return 0;
  return (
    ratio(
      pool.filter((day) => day.accountId === accountId).reduce((n, d) => n + (d.results ?? 0), 0),
      pool.reduce((n, d) => n + (d.results ?? 0), 0),
    ) ?? 0
  );
}
export function codLeads(
  sales: AdsSalesV23,
  summary: AdsSummaryV23,
  storeId = "all",
  accountId = "all",
) {
  return (sales.shopifyCod?.leadsDaily ?? [])
    .filter(
      (row) =>
        sales.shopifyCod?.storeIds.includes(row.storeId) &&
        (storeId === "all" || row.storeId === storeId),
    )
    .reduce(
      (n, row) => {
        const share = leadAccountShare(row, summary.days, accountId);
        return {
          leads: n.leads + row.leads * share,
          converted: n.converted + row.converted * share,
        };
      },
      { leads: 0, converted: 0 },
    );
}
export function breakdownV23(
  kind: "channel" | "seller" | "account",
  summary: AdsSummaryV23,
  sales: AdsSalesV23,
  storeId = "all",
  accountId = "all",
) {
  const groups = new Map<string, V23Breakdown>();
  const get = (id: string, name: string) => {
    if (!groups.has(id))
      groups.set(id, { id, name, rows: [], days: [], leads: 0, estimated: false });
    return groups.get(id)!;
  };
  const rows = v23Scope(sales.daily, summary, storeId, accountId),
    days = scopeDays(summary, storeId, accountId);
  if (kind === "account")
    for (const account of summary.accounts ?? [])
      if (accountId === "all" || account.id === accountId) get(account.id, account.name);
  const sellerName = (id: string) =>
    summary.sellers?.find((s) => s.id === id)?.name ??
    rows.find((r) => r.sellerId === id)?.sellerName ??
    id;
  for (const day of days) {
    if (kind === "channel") {
      get(
        day.channelExact ?? "unassigned",
        channelName(day.channelExact ?? "unassigned"),
      ).days.push(day);
      continue;
    }
    if (kind === "account") {
      get(
        day.accountId,
        summary.accounts?.find((a) => a.id === day.accountId)?.name ?? day.accountId,
      ).days.push(day);
      continue;
    }
    if (day.channelExact === "shopify_cod" && day.sellerMode !== "fixed") {
      const leadRows = (sales.shopifyCod?.byAssignedSeller ?? []).filter(
          (r) => r.storeId === day.storeId,
        ),
        denominator = leadRows.reduce((sum, r) => sum + r.leads, 0);
      if (denominator > 0) {
        for (const lead of leadRows)
          get(
            lead.sellerId ?? "cod-none",
            lead.sellerId ? sellerName(lead.sellerId) : "COD · sin vendedora",
          ).days.push({
            ...day,
            spend:
              day.spend === null ? null : String((Number(day.spend) * lead.leads) / denominator),
          });
        continue;
      }
      get("cod-none", "COD · sin vendedora").days.push(day);
      continue;
    }
    const id = day.sellerId ?? (day.channel === "web" ? "web-none" : "none");
    get(
      id,
      day.sellerId
        ? sellerName(day.sellerId)
        : id === "web-none"
          ? "Web · sin vendedora"
          : "Sin vendedora asignada",
    ).days.push(day);
  }
  for (const row of rows) {
    if (kind === "channel") {
      const id = exactSalesChannel(row.channel);
      get(id, channelName(id)).rows.push(row);
      continue;
    }
    if (kind === "account") {
      const id = row.accountId ?? "unattributed";
      get(
        id,
        summary.accounts?.find((a) => a.id === id)?.name ??
          "Sin atribución · sin resultados para estimar",
      ).rows.push(row);
      continue;
    }
    if (row.sellerId) {
      get(row.sellerId, row.sellerName ?? sellerName(row.sellerId)).rows.push(row);
      continue;
    }
    // Estimate only the missing confirming seller; a recorded confirmation owner always wins.
    const weights = new Map<string, number>();
    const matching = days.filter(
      (day) =>
        day.storeId === row.storeId &&
        day.channelExact ===
          (exactSalesChannel(row.channel) === "shopify" ? "web" : exactSalesChannel(row.channel)) &&
        (!row.accountId || day.accountId === row.accountId) &&
        day.sellerId &&
        day.channelExact !== "shopify_cod",
    );
    if (!matching.some((day) => day.results === null))
      for (const day of matching)
        weights.set(day.sellerId!, (weights.get(day.sellerId!) ?? 0) + (day.results ?? 0));
    for (const known of rows.filter(
      (known) =>
        known.sellerId &&
        known.storeId === row.storeId &&
        poolKey(known) === poolKey(row) &&
        (!row.accountId || known.accountId === row.accountId),
    ))
      if (weights.has(known.sellerId!))
        weights.set(known.sellerId!, Math.max(0, weights.get(known.sellerId!)! - known.orders));
    const total = [...weights.values()].reduce((n, w) => n + w, 0);
    if (total > 0) {
      for (const [id, weight] of weights) {
        const group = get(id, sellerName(id));
        group.rows.push({ ...scaleRow(row, weight / total), sellerId: id, sellerEstimated: true });
        group.estimated = true;
      }
    } else {
      const id =
        exactSalesChannel(row.channel) === "shopify_cod"
          ? "cod-none"
          : row.channelFamily === "web"
            ? "web-none"
            : "none";
      get(
        id,
        id === "cod-none"
          ? "COD · sin vendedora"
          : id === "web-none"
            ? "Web · sin vendedora"
            : "Sin confirmadora registrada",
      ).rows.push(row);
    }
  }
  if (kind === "channel")
    get("shopify_cod", channelName("shopify_cod")).leads = codLeads(
      sales,
      summary,
      storeId,
      accountId,
    ).leads;
  if (kind === "account")
    for (const lead of sales.shopifyCod?.leadsDaily ?? []) {
      if (
        !sales.shopifyCod?.storeIds.includes(lead.storeId) ||
        (storeId !== "all" && lead.storeId !== storeId)
      )
        continue;
      const ids = [
        ...new Set([
          ...(summary.accounts ?? []).map((a) => a.id),
          ...days.map((d) => d.accountId),
          ...(lead.accountId ? [lead.accountId] : []),
        ]),
      ].filter((id) => accountId === "all" || id === accountId);
      let used = 0;
      for (const id of ids) {
        const share = leadAccountShare(lead, summary.days, id);
        if (share > 0) {
          get(id, summary.accounts?.find((a) => a.id === id)?.name ?? id).leads +=
            lead.leads * share;
          used += share;
        }
      }
      if (accountId === "all" && used < 1)
        get("unattributed", "Sin atribución · sin resultados para estimar").leads +=
          lead.leads * (1 - used);
    }
  return [...groups.values()]
    .filter(
      (g) =>
        g.days.length ||
        g.rows.length ||
        g.leads ||
        (kind === "account" && summary.accounts?.some((a) => a.id === g.id)),
    )
    .map((group) => ({
      ...group,
      estimated: group.estimated || group.rows.some((row) => row.estimated),
    }));
}

export function monthlyV23(
  summary: AdsSummaryV23,
  sales: AdsSalesV23,
  month: string,
  storeId = "all",
  accountId = "all",
  family = "all",
  today = summary.today,
) {
  const from = `${month}-01`,
    to = format(endOfMonth(parseISO(from)), "yyyy-MM-dd"),
    days = dateRange(from, to),
    effectiveTo = to < today ? to : today;
  const allRows = v23Scope(sales.daily, summary, storeId, accountId, family),
    allDays = scopeDays(summary, storeId, accountId, family);
  const selectedStores = summary.stores.filter((s) => storeId === "all" || s.id === storeId);
  const budgets = selectedStores.map((s) =>
    summary.settings.budgets.find((b) => b.storeId === s.id && b.month.slice(0, 7) === month),
  );
  // A store budget cannot be silently reused as an account or channel budget.
  const budget =
    accountId !== "all" || family !== "all" || budgets.some((b) => !b)
      ? null
      : budgets.reduce((n, b) => n + Number(b!.amount), 0);
  let accumulatedSpend: number | null = 0,
    accumulatedGain: number | null = 0;
  const data = days.map((date) => {
    const daySummary = {
      ...summary,
      from: date,
      to: date,
      quality: {
        ...summary.quality,
        spendScopes: summary.quality.spendScopes?.map((scope) => ({
          ...scope,
          spendAvailable:
            scope.days.find((d) => d.date === date)?.spendAvailable ?? scope.spendAvailable,
        })),
      },
    };
    const metric = v23Financial(
      allRows.filter((r) => r.date === date),
      daySummary,
      sales,
      storeId,
      accountId,
      family,
      allDays.filter((d) => d.date === date),
    );
    const future = date > effectiveTo,
      closed = date < today;
    const availableScope = summary.quality.spendScopes?.find((s) => s.storeId === storeId);
    const availableDay = availableScope?.days.find((d) => d.date === date);
    if (!future && availableDay && !availableDay.spendAvailable) {
      metric.spend = null;
      metric.cpv = null;
      metric.cpp = null;
      metric.gain = null;
      metric.projectedGain = null;
    }
    if (!future) {
      accumulatedSpend =
        accumulatedSpend === null || metric.spend === null ? null : accumulatedSpend + metric.spend;
      accumulatedGain =
        accumulatedGain === null || metric.projectedGain === null
          ? null
          : accumulatedGain + metric.projectedGain;
    }
    return {
      date,
      week: format(startOfWeek(parseISO(date), { weekStartsOn: 1 }), "yyyy-MM-dd"),
      future,
      closed,
      metric,
      accumulatedSpend: future ? null : accumulatedSpend,
      accumulatedGain: future ? null : accumulatedGain,
      ideal: budget === null ? null : (budget / days.length) * (days.indexOf(date) + 1),
    };
  });
  const elapsed = data.filter((d) => !d.future),
    closed = data.filter((d) => d.closed && !d.future),
    remaining = data.filter((d) => d.future).length;
  const total = v23Financial(allRows, summary, sales, storeId, accountId, family, allDays);
  const average = (key: "spend" | "projectedGain") =>
    closed.length && closed.every((d) => d.metric[key] !== null)
      ? closed.reduce((n, d) => n + d.metric[key]!, 0) / closed.length
      : null;
  const dailyAverage = average("spend"),
    gainAverage = average("projectedGain");
  const projectedSpend =
    remaining === 0
      ? total.spend
      : total.spend === null || dailyAverage === null
        ? null
        : total.spend + dailyAverage * remaining;
  const projectedGain =
    remaining === 0
      ? total.gain
      : total.projectedGain === null || gainAverage === null
        ? null
        : total.projectedGain + gainAverage * remaining;
  const financiallyClosed = closed.filter((d) => d.metric.inTransit === 0);
  const profitable = financiallyClosed.filter(
    (d) => d.metric.gain !== null && d.metric.gain >= 0,
  ).length;
  const ranked = closed
    .filter((d) => d.metric.projectedGain !== null)
    .sort((a, b) => b.metric.projectedGain! - a.metric.projectedGain!);
  return {
    from,
    to,
    effectiveTo,
    data,
    total,
    budget,
    elapsed: elapsed.length,
    closed: financiallyClosed.length,
    closedCalendarDays: closed.length,
    remaining,
    dailyAverage,
    projectedSpend,
    projectedGain,
    profitable,
    best: ranked[0]?.date,
    worst: ranked.at(-1)?.date,
    maxDaily:
      budget === null || total.spend === null || !remaining
        ? null
        : Math.max(0, (budget - total.spend) / remaining),
  };
}
