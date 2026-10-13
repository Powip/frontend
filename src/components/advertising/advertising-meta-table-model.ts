import type {
  MetaCatalogLevel,
  MetaCatalogResponse,
  MetaCatalogRow,
  MetaResultType,
} from "@/services/advertisingMetaService";
import type { AdvertisingBusinessAnalytics } from "@/services/advertisingOrdersService";
import { formatAdvertisingMetric } from "./advertising-business-metrics-model";
import { businessCountAvailable, businessResult } from "./advertising-business-results";
import {
  formatMetaCostPerResult,
  formatMetaNumber,
  formatMetaResultCount,
  formatMetaSpend,
  metaResultAvailabilityLabel,
  metaResultLabel,
} from "./advertising-meta-model";

export interface AdvertisingMetaBusinessValues {
  leads: string;
  sales: string;
  delivered: string;
  returned: string;
  roas: string;
  platformPurchases: string;
  platformCpa: string;
}

/** Counts use their actual event date; an unconfirmed order is never allocated to an ad. */
export function advertisingMetaBusinessValues(
  row: MetaCatalogRow,
  meta: MetaCatalogResponse | null,
  sources: {
    sales?: AdvertisingBusinessAnalytics;
    delivered?: AdvertisingBusinessAnalytics;
    paid?: AdvertisingBusinessAnalytics;
  },
  storeId: string,
): AdvertisingMetaBusinessValues {
  const purchases = row.insights.resultMetrics?.webPurchases;
  const leads = row.insights.resultMetrics?.leads;
  const values: AdvertisingMetaBusinessValues = {
    leads:
      leads?.status === "complete" && leads.count !== null
        ? formatMetaResultCount(leads)
        : "Pendiente",
    sales: "Pendiente",
    delivered: "Pendiente",
    returned: "Pendiente",
    roas: "Pendiente",
    platformPurchases:
      purchases?.status === "complete" ? formatMetaResultCount(purchases) : "Pendiente",
    platformCpa:
      purchases?.status === "complete" && purchases.costPerResult !== null
        ? formatMetaCostPerResult(purchases, row.currency)
        : "Pendiente",
  };
  if ((row.level !== "ad" && row.level !== "campaign") || storeId === "none") return values;
  for (const [key, basis] of [
    ["sales", "created"],
    ["delivered", "delivered"],
    ["paid", "paid"],
  ] as const) {
    const analytics = sources[key];
    if (
      analytics?.source !== "powip-orders" ||
      analytics.groupBy !== row.level ||
      analytics.basis !== basis ||
      (analytics.storeId ?? "all") !== storeId ||
      (analytics.channelId ?? "all") !== "all"
    )
      continue;
    const matches = analytics.rows.filter(
      (item) =>
        item.id === row.id && item.accountId === row.accountId && item.currency === row.currency,
    );
    if (matches.length !== 1) continue;
    try {
      if (!businessCountAvailable(matches[0], analytics, meta, storeId)) continue;
      const count = key === "sales" ? matches[0].orderCount : matches[0].deliveredCount;
      if (key !== "paid" && Number.isSafeInteger(count) && count >= 0)
        values[key] = formatMetaNumber(String(count));
      if (key === "paid") {
        const result = businessResult(matches[0], analytics, meta);
        if (result.paidRoas !== null) values.roas = `${formatAdvertisingMetric(result.paidRoas)}×`;
      }
    } catch {
      // Invalid or partial financial data must remain unknown.
    }
  }
  return values;
}

export function advertisingMetaExtraColumns(level: MetaCatalogLevel) {
  return level === "ad"
    ? ([
        { key: "leads", label: "Leads" },
        { key: "sales", label: "Ventas" },
        { key: "delivered", label: "Entregados" },
        { key: "returned", label: "Devueltos" },
        { key: "roas", label: "ROAS" },
        { key: "platformPurchases", label: "Meta dice" },
      ] as const)
    : ([
        { key: "sales", label: "Ventas" },
        { key: "delivered", label: "Entregados" },
        { key: "roas", label: "ROAS" },
        { key: "platformCpa", label: "CPA plataforma" },
      ] as const);
}

export function advertisingMetaTableValues(
  row: MetaCatalogRow,
  resultType: MetaResultType,
  cpe: string | null,
  deliveredCount?: number,
  business?: AdvertisingMetaBusinessValues,
  cpeReason?: string | null,
) {
  const result = row.insights.results;
  const legacy = row.insights.resultMetrics?.[resultType];
  const high =
    row.insights.frequency &&
    /^\d+(?:\.\d+)?$/.test(row.insights.frequency) &&
    Number(row.insights.frequency) > 3;
  return {
    business: business ?? advertisingMetaBusinessValues(row, null, {}, "all"),
    availability: result
      ? result.value === null || !/^\d+(?:\.\d+)?$/.test(result.value)
        ? "No disponible"
        : row.insights.coverage?.status === "complete"
          ? "Completo"
          : "Parcial"
      : metaResultAvailabilityLabel(legacy),
    resultType: result?.label ?? metaResultLabel(resultType),
    count: result ? formatMetaNumber(result.value) : formatMetaResultCount(legacy),
    costPerResult: result
      ? formatMetaSpend(row.insights.costPerResult ?? null, row.currency)
      : formatMetaCostPerResult(legacy, row.currency),
    ctr: formatAdvertisingMetric(row.insights.ctr, " %"),
    frequency: `${formatAdvertisingMetric(row.insights.frequency)}${row.insights.frequencyApproximate ? " · aprox." : ""}`,
    cpe: cpe ? formatMetaSpend(cpe, row.currency) : "Pendiente",
    cpeReason: cpe ? null : (cpeReason ?? "Solo pedidos con anuncio confirmado."),
    recommendation:
      cpe && deliveredCount !== undefined && deliveredCount < 10
        ? "Pocos datos"
        : high
          ? "Revisar frecuencia"
          : cpe
            ? "CPE disponible"
            : "CPE por confirmar",
    spend: formatMetaSpend(row.insights.spend, row.currency),
    impressions: formatMetaNumber(row.insights.impressions),
    linkClicks: formatMetaNumber(row.insights.inlineLinkClicks ?? null),
    reach: formatMetaNumber(row.insights.reach ?? null),
  };
}
export function advertisingCsvCell(value: string) {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}
export function advertisingMetaTableCsv(
  rows: Array<{
    row: MetaCatalogRow;
    values: ReturnType<typeof advertisingMetaTableValues>;
  }>,
  more: boolean,
  level: MetaCatalogLevel = rows[0]?.row.level ?? "ad",
) {
  const extraColumns = advertisingMetaExtraColumns(level);
  const headers = [
    "Nombre",
    "Moneda",
    "Gasto",
    "Tipo de resultado",
    "Resultados",
    "Costo por resultado · Meta",
    "CTR de enlace",
    "Frecuencia",
    "Costo por entregado",
    "Recomendación",
    "Disponibilidad",
    ...(more
      ? [...extraColumns.map((column) => column.label), "Impresiones", "Clics en enlace", "Alcance"]
      : []),
  ];
  return [
    headers,
    ...rows.map(({ row, values }) => [
      row.name,
      row.currency,
      values.spend,
      values.resultType,
      values.count,
      values.costPerResult,
      values.ctr,
      values.frequency,
      values.cpe,
      values.recommendation,
      values.availability,
      ...(more
        ? [
            ...extraColumns.map((column) => values.business[column.key]),
            values.impressions,
            values.linkClicks,
            values.reach,
          ]
        : []),
    ]),
  ]
    .map((cells) => cells.map(advertisingCsvCell).join(","))
    .join("\r\n");
}
