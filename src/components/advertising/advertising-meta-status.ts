/**
 * Meta statuses shown in Publicidad, kept apart on purpose:
 * - Account `account_status` (https://developers.facebook.com/docs/marketing-api/reference/ad-account/)
 *   says whether Meta lets the account run ads.
 * - Campaign / ad set / ad `effective_status`
 *   (https://developers.facebook.com/docs/marketing-api/reference/ad-campaign-group/,
 *   https://developers.facebook.com/docs/marketing-api/reference/ad-campaign/,
 *   https://developers.facebook.com/docs/marketing-api/reference/adgroup/)
 *   says whether each object is delivering.
 * An active account can have no active campaigns. Unknown codes are shown as unknown, never guessed.
 */

export type MetaStatusFilter = "active" | "inactive" | "all";
export type MetaStatusState = "active" | "inactive" | "unknown";

export interface MetaAccountStatusWire {
  code: number | null;
  key: string | null;
  disableReasonCode: number | null;
  disableReasonKey: string | null;
}

export type MetaAccountCampaignsWire =
  | { known: false }
  | { known: true; active: number; total: number; updatedAt: string };

const ACCOUNT_LABELS: Record<string, string> = {
  ACTIVE: "Activa",
  DISABLED: "Deshabilitada",
  UNSETTLED: "Pago pendiente",
  PENDING_RISK_REVIEW: "En revisión de riesgo",
  PENDING_SETTLEMENT: "Pago en proceso",
  IN_GRACE_PERIOD: "En periodo de gracia",
  PENDING_CLOSURE: "Cierre pendiente",
  CLOSED: "Cerrada",
  ANY_ACTIVE: "Activa (valor agrupado de Meta)",
  ANY_CLOSED: "Cerrada (valor agrupado de Meta)",
};

const DISABLE_REASON_LABELS: Record<string, string> = {
  ADS_INTEGRITY_POLICY: "política de integridad de anuncios",
  ADS_IP_REVIEW: "revisión de propiedad intelectual",
  RISK_PAYMENT: "riesgo en el pago",
  GRAY_ACCOUNT_SHUT_DOWN: "cuenta cerrada por Meta",
  ADS_AFC_REVIEW: "revisión AFC de Meta",
  BUSINESS_INTEGRITY_RAR: "integridad del negocio",
  PERMANENT_CLOSE: "cierre permanente",
  UNUSED_RESELLER_ACCOUNT: "cuenta de revendedor sin uso",
  UNUSED_ACCOUNT: "cuenta sin uso",
  UMBRELLA_AD_ACCOUNT: "cuenta paraguas",
  BUSINESS_MANAGER_INTEGRITY_POLICY: "política de Business Manager",
  MISREPRESENTED_AD_ACCOUNT: "cuenta tergiversada",
  AOAB_DESHARE_LEGAL_ENTITY: "la entidad legal dejó de compartirla",
  CTX_THREAD_REVIEW: "revisión de conversación",
  COMPROMISED_AD_ACCOUNT: "cuenta comprometida",
};

/** Only the documented ACTIVE code counts as active; aggregate or unknown codes stay unknown. */
export function accountStatusState(
  status: MetaAccountStatusWire | null | undefined,
): MetaStatusState {
  if (!status || status.key === null) return "unknown";
  if (status.key === "ACTIVE") return "active";
  if (status.key === "ANY_ACTIVE" || status.key === "ANY_CLOSED") return "unknown";
  return "inactive";
}

export function accountStatusLabel(status: MetaAccountStatusWire | null | undefined): string {
  if (!status || status.code === null) return "Estado no informado por Meta";
  if (status.key === null) return `Estado desconocido (código ${status.code})`;
  return ACCOUNT_LABELS[status.key] ?? `Estado desconocido (código ${status.code})`;
}

export function accountDisableReasonLabel(
  status: MetaAccountStatusWire | null | undefined,
): string | null {
  if (!status || status.disableReasonCode === null || status.disableReasonCode === 0) return null;
  const label = status.disableReasonKey
    ? DISABLE_REASON_LABELS[status.disableReasonKey]
    : undefined;
  return label ? `Motivo: ${label}` : `Motivo desconocido (código ${status.disableReasonCode})`;
}

/** Separate from the account status: what the local catalog says about campaigns. */
export function accountCampaignsLabel(
  campaigns: MetaAccountCampaignsWire | null | undefined,
): string {
  if (!campaigns?.known) return "Campañas activas: sin importar, no sabemos";
  const when = new Intl.DateTimeFormat("es-PE", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Lima",
  }).format(new Date(campaigns.updatedAt));
  // total = campaigns Meta returned (active, paused, archived; Meta never returns deleted ones).
  const stopped = campaigns.total - campaigns.active;
  const count =
    campaigns.total === 0
      ? "Meta no devolvió campañas (las borradas no se cuentan)"
      : campaigns.active > 0
        ? `${campaigns.active} de ${campaigns.total} campañas activas`
        : `Ninguna campaña activa · ${stopped} ${stopped === 1 ? "pausada o archivada" : "pausadas o archivadas"}`;
  return `${count} · lectura del ${when}`;
}

const limaTime = (value: string) =>
  new Intl.DateTimeFormat("es-PE", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Lima",
  }).format(new Date(value));

interface RateLimitedAccountWire {
  coverage?: { lastAttemptAt?: string | null } | null;
  historyImport?: { nextAttemptAt?: string | null } | null;
}

/** Says since when Meta refused and from when we try again (only accounts being imported). */
export function metaRateLimitLabel(
  accounts: RateLimitedAccountWire[],
  now: number = Date.now(),
): string {
  const since = accounts
    .map((account) => account.coverage?.lastAttemptAt)
    .filter((value): value is string => !!value)
    .sort()[0];
  const retry = accounts
    .map((account) => account.historyImport?.nextAttemptAt)
    .filter((value): value is string => !!value)
    .sort()
    .at(-1);
  const parts = ["Meta limitó la actualización"];
  if (since) parts.push(`desde ${limaTime(since)}`);
  if (retry && Date.parse(retry) > now) parts.push(`· reintento desde ${limaTime(retry)}`);
  else parts.push("· ya puedes volver a pulsar «Actualizar Meta»");
  return parts.join(" ");
}

/** Campaign, ad set and ad `effective_status`: ACTIVE delivers; any other documented value does not. */
export function effectiveStatusState(effectiveStatus: string | null | undefined): MetaStatusState {
  if (!effectiveStatus) return "unknown";
  return effectiveStatus.toUpperCase() === "ACTIVE" ? "active" : "inactive";
}

export function matchesStatusFilter(state: MetaStatusState, filter: MetaStatusFilter): boolean {
  if (filter === "all") return true;
  return state === filter;
}

function normalize(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

export function matchesSearch(query: string, ...fields: Array<string | null | undefined>): boolean {
  const needle = normalize(query);
  if (!needle) return true;
  return fields.some((field) => field && normalize(field).includes(needle));
}

export function statusCounts<T>(
  items: T[],
  stateOf: (item: T) => MetaStatusState,
): Record<MetaStatusFilter, number> {
  let active = 0;
  let inactive = 0;
  for (const item of items) {
    const state = stateOf(item);
    if (state === "active") active += 1;
    else if (state === "inactive") inactive += 1;
  }
  return { active, inactive, all: items.length };
}
