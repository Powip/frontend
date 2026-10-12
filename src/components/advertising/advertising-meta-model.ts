import type {
  MetaAction,
  MetaCoverage,
  MetaResultMetric,
  MetaResultType,
} from "@/services/advertisingMetaService";
import { formatAdvertisingDecimal } from "./advertising-decimal";

const ACTION_LABELS: Record<string, string> = {
  "onsite_conversion.messaging_conversation_started_7d": "Conversaciones iniciadas",
  "onsite_conversion.total_messaging_connection": "Contactos de mensajes",
  initiate_checkout: "Checkouts iniciados",
  purchase: "Compras",
  omni_purchase: "Compras omnicanal",
  "offsite_conversion.fb_pixel_purchase": "Compras del píxel",
  "offsite_conversion.fb_pixel_initiate_checkout": "Checkouts del píxel",
  lead: "Leads",
  "onsite_conversion.lead_grouped": "Leads en Meta",
  link_click: "Clics en enlaces",
  landing_page_view: "Vistas de página de destino",
};
const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Activo",
  PAUSED: "Pausado",
  ARCHIVED: "Archivado",
  DELETED: "Eliminado",
  ADSET_PAUSED: "Conjunto pausado",
  CAMPAIGN_PAUSED: "Campaña pausada",
  PENDING_REVIEW: "En revisión",
  DISAPPROVED: "Rechazado",
  WITH_ISSUES: "Con incidencias",
};

function validDecimal(value: string | null): value is string {
  return value !== null && value.length <= 1024 && /^\d+(?:\.\d+)?$/.test(value);
}

export function formatMetaNumber(value: string | null) {
  if (!validDecimal(value)) return "No disponible";
  const [whole, fraction] = value.split(".");
  const grouped = new Intl.NumberFormat("es-PE").format(BigInt(whole));
  return fraction ? `${grouped}.${fraction}` : grouped;
}

export function formatMetaSpend(value: string | null, currency: string) {
  if (!validDecimal(value)) return "No disponible";
  try {
    return formatAdvertisingDecimal(value, currency);
  } catch {
    return "No disponible";
  }
}

export function metaResultLabel(type: MetaResultType) {
  return type === "messages" ? "Mensajes" : "Compras por web";
}

export function metaResultDescription(type: MetaResultType) {
  return type === "messages" ? "Conversaciones iniciadas" : "Compras en el sitio web";
}

/** Only server metrics preserve the completeness of each imported ad/day. */
export function formatMetaResultCount(metric: MetaResultMetric | undefined) {
  return formatMetaNumber(metric?.count ?? null);
}

export function formatMetaCostPerResult(metric: MetaResultMetric | undefined, currency: string) {
  if (metric?.status !== "complete" || !validDecimal(metric.count)) return "No disponible";
  if (/^0+(?:\.0+)?$/.test(metric.count)) return "—";
  return formatMetaSpend(metric.costPerResult, currency);
}

export function metaSpendReconciled(coverage: MetaCoverage): boolean {
  const reconciliation = coverage.reconciliation;
  return (
    coverage.status === "complete" &&
    Number.isInteger(coverage.totalDays) &&
    coverage.totalDays > 0 &&
    coverage.coveredDays === coverage.totalDays &&
    coverage.provisionalDays === 0 &&
    reconciliation?.status === "matched" &&
    reconciliation.comparedDays === reconciliation.totalDays &&
    reconciliation.totalDays === coverage.totalDays &&
    reconciliation.mismatchedDays === 0 &&
    reconciliation.missingLedgerDays === 0 &&
    reconciliation.provisionalDays === 0
  );
}
export function metaCoverageLabel(coverage: MetaCoverage) {
  if (coverage.reconciliation?.status === "mismatch") return "Gasto por revisar";
  if (coverage.status === "complete" && !metaSpendReconciled(coverage))
    return "Gasto por confirmar";
  return coverage.status === "complete"
    ? "Datos completos"
    : coverage.status === "partial"
      ? "Datos parciales"
      : "Datos pendientes";
}
export function metaStatusLabel(status: string | null) {
  return status === null ? "Estado no disponible" : (STATUS_LABELS[status] ?? status);
}
export function metaActionLabel(actionType: string) {
  return ACTION_LABELS[actionType] ?? actionType;
}
export function metaActionValue(actions: MetaAction[] | null, actionType: string) {
  return actions?.find((action) => action.actionType === actionType)?.value ?? null;
}

/** Inclusive provider calendar days; catalog/sync endpoints accept at most 366. */
export function validMetaPeriod(from: string, to: string) {
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(from) &&
    /^\d{4}-\d{2}-\d{2}$/.test(to) &&
    Number.isFinite(start) &&
    Number.isFinite(end) &&
    new Date(start).toISOString().slice(0, 10) === from &&
    new Date(end).toISOString().slice(0, 10) === to &&
    end >= start &&
    (end - start) / 86_400_000 < 366
  );
}

/** Never trust a URL from a report as a credential-bearing or arbitrary navigation target. */
export function metaAdsManagerUrl(externalAccountId: string) {
  return /^\d+$/.test(externalAccountId)
    ? `https://adsmanager.facebook.com/adsmanager/manage/ads?act=${externalAccountId}`
    : null;
}
