import type {
  ShopifyHealthStatus,
  ShopifyLocation,
  ShopifyReauthorizationReason,
  ShopifyStockCounters,
  ShopifyStockMode,
  ShopifyStockPrecondition,
  ShopifyStockReport,
  ShopifyStockReportItem,
  ShopifyStockRun,
  ShopifyStockRunState,
  ShopifyStockRunStatus,
  ShopifyStockShop,
} from "@/services/shopifyStockService";

// FEAT-24 H1-D (H1D-5) — lógica de la pantalla de stock de Shopify, sin React:
// etiquetas, contadores del reporte, listas, lectura del 422 del cambio de modo
// y el sondeo de una corrida a pedido.

export const STOCK_MODE_LABELS: Record<ShopifyStockMode, string> = {
  shopify: "Shopify manda",
  reporte: "Solo reporte",
  powip: "Powip manda",
};

export const STOCK_MODE_DESCRIPTIONS: Record<ShopifyStockMode, string> = {
  shopify: "Como hasta hoy: Shopify actualiza el stock de Powip con sus números.",
  reporte:
    "Shopify sigue mandando. Powip compara su stock con el de Shopify y muestra las diferencias, sin escribir nada en Shopify.",
  powip:
    "Powip publica su disponible en la ubicación elegida de Shopify y los cambios de stock en Shopify dejan de pisar el de Powip.",
};

export const STOCK_MODES: readonly ShopifyStockMode[] = ["shopify", "reporte", "powip"];

export const HEALTH_LABELS: Record<ShopifyHealthStatus, string> = {
  ok: "Conectada",
  token_revocado: "Acceso revocado",
  plan_impago: "Plan de Shopify impago",
  desinstalada: "App desinstalada",
  error: "Con errores",
};

export const RUN_STATUS_LABELS: Record<ShopifyStockRunStatus, string> = {
  running: "En curso",
  ok: "Terminado",
  error: "Con error",
  skipped: "No se completó",
};

export const REAUTH_REASON_LABELS: Record<ShopifyReauthorizationReason, string> = {
  token_revocado: "Shopify revocó el acceso de la app",
  desinstalada: "La app fue desinstalada de la tienda",
  token_rechazado: "Shopify rechazó el acceso de la app",
  marcada_para_reautorizar: "La tienda quedó marcada para volver a autorizar",
  faltan_scopes: "Faltan permisos de inventario",
};

const SCOPE_LABELS: Record<string, string> = {
  read_inventory: "leer el inventario",
  write_inventory: "escribir el inventario",
  read_locations: "leer las ubicaciones",
};

export const scopeLabel = (scope: string): string => SCOPE_LABELS[scope] ?? scope;

// ===== Contadores =====

export type CounterTone = "neutral" | "ok" | "warn" | "danger";

export interface CounterView {
  key: string;
  label: string;
  value: number;
  hint: string;
  tone: CounterTone;
}

const n = (v: unknown): number => {
  const num = Number(v);
  return Number.isFinite(num) ? num : 0;
};

/** Contadores de una corrida, en el orden y con los nombres de la pantalla. */
export function summarizeCounters(counters: Partial<ShopifyStockCounters> | null | undefined): CounterView[] {
  const c = counters ?? {};
  const toPublish = n(c.to_publish);
  const wouldZero = n(c.would_zero);
  const wouldZeroDeny = n(c.would_zero_deny);
  const skuMismatch = n(c.skipped_sku_mismatch);
  const multi = n(c.multi_location_diff);
  const unlinked = n(c.skipped_unlinked) + n(c.skipped_sku_only);
  const otherSkips =
    n(c.skipped_duplicate) +
    n(c.skipped_untracked) +
    n(c.skipped_not_stocked) +
    n(c.skipped_not_in_warehouse) +
    n(c.skipped_out_of_range);
  const errors = n(c.errors);
  const warnIf = (value: number): CounterTone => (value > 0 ? "warn" : "neutral");
  return [
    { key: "revisadas", label: "Revisadas", value: n(c.seen), tone: "neutral", hint: "Variantes de Shopify leídas" },
    { key: "iguales", label: "Iguales", value: n(c.unchanged), tone: "ok", hint: "Powip y Shopify tienen el mismo número" },
    {
      key: "a_publicar",
      label: "A publicar",
      value: toPublish,
      tone: warnIf(toPublish),
      hint: "Powip y Shopify tienen números distintos: con «Powip manda» se publicaría el de Powip",
    },
    {
      key: "quedarian_en_0",
      label: "Quedarían en 0",
      value: wouldZero,
      tone: warnIf(wouldZero),
      hint: "Shopify tiene stock y Powip no: quedarían agotadas en Shopify",
    },
    {
      key: "frenan_venta",
      label: "Frenan la venta",
      value: wouldZeroDeny,
      tone: wouldZeroDeny > 0 ? "danger" : "neutral",
      hint: "Quedarían en 0 y no permiten vender sin stock: dejarían de venderse en la tienda online",
    },
    {
      key: "sku_no_cruzan",
      label: "SKU que no cruzan",
      value: skuMismatch,
      tone: warnIf(skuMismatch),
      hint: "El SKU de Shopify no coincide con el del producto vinculado en Powip: no se publican",
    },
    {
      key: "varias_ubicaciones",
      label: "Varias ubicaciones",
      value: multi,
      tone: warnIf(multi),
      hint: "La suma de las ubicaciones activas de Shopify es distinta del número de la ubicación elegida",
    },
    {
      key: "sin_vincular",
      label: "Sin vincular",
      value: unlinked,
      tone: warnIf(unlinked),
      hint: "Variantes de Shopify sin un producto vinculado en Powip: no se publican",
    },
    {
      key: "otros_saltos",
      label: "Otros saltos",
      value: otherSkips,
      tone: "neutral",
      hint: "Sin seguimiento de inventario, duplicadas, fuera de la ubicación o del almacén, o con números fuera de rango",
    },
    { key: "errores", label: "Errores", value: errors, tone: errors > 0 ? "danger" : "neutral", hint: "Fallas al leer o escribir" },
  ];
}

// ===== Listas del reporte =====

export type ReportListKey =
  | "a_publicar"
  | "quedarian_en_0"
  | "frenan_venta"
  | "sku_no_cruzan"
  | "varias_ubicaciones"
  | "sin_vincular";

export interface ReportList {
  key: ReportListKey;
  label: string;
  description: string;
  /** Total de la corrida (puede ser mayor que los listados). */
  total: number;
  items: ShopifyStockReportItem[];
}

const DIFF_ACTIONS = ["publish", "published", "changed", "error"];
const UNLINKED_ACTIONS = ["skip_unlinked", "skip_sku_only"];

function fromGroups(report: ShopifyStockReport, actions: string[]): { total: number; items: ShopifyStockReportItem[] } {
  const groups = report.groups.filter((g) => actions.includes(g.action));
  return {
    total: groups.reduce((sum, g) => sum + n(g.total), 0),
    items: groups.flatMap((g) => g.items),
  };
}

const isZeroOverStock = (item: ShopifyStockReportItem) => item.powipAvailable === 0 && n(item.shopifyAvailable) > 0;

/** Las listas del reporte, en el orden de la pantalla. */
export function reportLists(report: ShopifyStockReport): ReportList[] {
  const diffs = fromGroups(report, DIFF_ACTIONS);
  const zero = diffs.items.filter(isZeroOverStock);
  const unlinked = fromGroups(report, UNLINKED_ACTIONS);
  const sku = fromGroups(report, ["skip_sku_mismatch"]);
  return [
    {
      key: "a_publicar",
      label: "A publicar",
      description: "Powip y Shopify tienen números distintos.",
      ...diffs,
    },
    {
      key: "quedarian_en_0",
      label: "Quedarían en 0",
      description: "Shopify tiene stock y Powip no: quedarían agotadas en Shopify.",
      total: report.run ? n(report.run.counters.would_zero) : zero.length,
      items: zero,
    },
    {
      key: "frenan_venta",
      label: "Frenan la venta",
      description: "Quedarían en 0 y no permiten vender sin stock: dejarían de venderse en la tienda online.",
      total: n(report.wouldZeroDeny.total),
      items: report.wouldZeroDeny.items,
    },
    {
      key: "sku_no_cruzan",
      label: "SKU que no cruzan",
      description: "El SKU de Shopify no coincide con el del producto vinculado en Powip. No se publican.",
      ...sku,
    },
    {
      key: "varias_ubicaciones",
      label: "Varias ubicaciones",
      description: "Powip publica solo en la ubicación elegida; la suma de todas las ubicaciones es distinta.",
      total: n(report.multiLocation.total),
      items: report.multiLocation.items,
    },
    {
      key: "sin_vincular",
      label: "Sin vincular",
      description: "Variantes de Shopify sin un producto vinculado en Powip. No se publican.",
      ...unlinked,
    },
  ];
}

// ===== Cambio de modo: lectura del rechazo =====

export const PRECONDITION_LABELS: Record<string, string> = {
  modo_powip_habilitado: "«Powip manda» todavía no está habilitado en Powip",
  confirmacion: "Falta confirmar el cambio",
  tienda_activa: "La tienda está dada de baja",
  salud_ok: "La conexión con Shopify no está funcionando",
  sin_reautorizacion: "Hay que volver a autorizar la app en Shopify",
  almacen_powip: "La tienda no tiene un almacén de Powip asignado",
  scopes_lectura: "Faltan permisos para leer el inventario en Shopify (volver a autorizar la app)",
  scope_write_inventory: "Falta el permiso para escribir el inventario en Shopify (volver a autorizar la app)",
  ubicacion: "Falta elegir una ubicación activa de Shopify",
  ubicaciones_online: "Otras ubicaciones de Shopify también despachan pedidos online",
  almacen_compartido: "Otras tiendas usan el mismo almacén y no están en «Powip manda»",
  ultimo_reporte_ok: "Falta un reporte completo y sin errores en «Solo reporte»",
  reporte_misma_ubicacion: "El último reporte comparó otra ubicación de Shopify",
  reporte_mismo_almacen: "El último reporte comparó otro almacén de Powip",
  reporte_reciente: "El último reporte es viejo: hace falta uno más reciente",
  venta_bloqueada: "Hay productos que dejarían de venderse en la tienda online",
};

export interface UnmetPrecondition {
  code: string;
  label: string;
  /** El texto del backend (más técnico), como detalle. */
  detail: string;
}

export interface ModeChangeFailure {
  status: number | null;
  message: string;
  currentMode: ShopifyStockMode | null;
  /** Lo que falta en la tienda pedida. */
  unmet: UnmetPrecondition[];
  /** Lo que falta en las otras tiendas del grupo (`groupShopIds`). */
  groupUnmet: Array<{ shopUrl: string; unmet: UnmetPrecondition[] }>;
  needsAckZeroDeny: boolean;
  needsAckMultiLocation: boolean;
  needsGroup: boolean;
  /** Variantes que frenarían la venta según el último reporte (del 422), si viene. */
  zeroDenyCount: number | null;
}

interface ModeErrorBody {
  message?: unknown;
  currentMode?: unknown;
  preconditions?: unknown;
  group?: unknown;
  lastRun?: { counters?: Partial<ShopifyStockCounters> } | null;
}

const isMode = (v: unknown): v is ShopifyStockMode => typeof v === "string" && (STOCK_MODES as readonly string[]).includes(v);

function unmetOf(preconditions: unknown): UnmetPrecondition[] {
  if (!Array.isArray(preconditions)) return [];
  return preconditions
    .filter((p): p is ShopifyStockPrecondition => !!p && typeof p === "object" && (p as ShopifyStockPrecondition).ok === false)
    .map((p) => ({
      code: String(p.code),
      label: PRECONDITION_LABELS[String(p.code)] ?? String(p.code),
      detail: typeof p.message === "string" ? p.message : "",
    }));
}

function backendMessage(body: ModeErrorBody | undefined): string | null {
  const message = body?.message;
  if (Array.isArray(message)) {
    const parts = message.filter((m): m is string => typeof m === "string" && m.trim() !== "");
    return parts.length ? parts.join(". ") : null;
  }
  return typeof message === "string" && message.trim() !== "" ? message : null;
}

const httpStatus = (error: unknown): number | null => {
  const status = (error as { response?: { status?: unknown } } | null)?.response?.status;
  return typeof status === "number" ? status : null;
};

const responseBody = <T,>(error: unknown): T | undefined =>
  (error as { response?: { data?: T } } | null)?.response?.data;

/** Lee el rechazo del PATCH de modo (422 con precondiciones, 409, 403, 404 u otro). */
export function parseModeChangeError(error: unknown): ModeChangeFailure {
  const status = httpStatus(error);
  const body = responseBody<ModeErrorBody>(error);
  const unmet = unmetOf(body?.preconditions);
  const groupUnmet = Array.isArray(body?.group)
    ? (body.group as Array<{ shopUrl?: unknown; preconditions?: unknown }>)
        .map((g) => ({ shopUrl: typeof g?.shopUrl === "string" ? g.shopUrl : "", unmet: unmetOf(g?.preconditions) }))
        .filter((g) => g.unmet.length > 0)
    : [];
  const all = [...unmet, ...groupUnmet.flatMap((g) => g.unmet)];
  const has = (code: string) => all.some((p) => p.code === code);
  const zeroDeny = body?.lastRun?.counters?.would_zero_deny;

  let message: string;
  if (status === 422) {
    message = all.length
      ? "Todavía no se puede cambiar el modo: falta lo que se lista abajo."
      : (backendMessage(body) ?? "No se puede cambiar el modo de esta tienda.");
  } else if (status === 409) {
    message = "La tienda cambió mientras se revisaba el pedido. Revisa su estado y vuelve a intentarlo.";
  } else if (status === 403) {
    message = "Solo un administrador de la empresa puede cambiar el modo de stock.";
  } else if (status === 404) {
    message = backendMessage(body) ?? "No se encontró esa tienda de Shopify en tu empresa.";
  } else {
    message = backendMessage(body) ?? "No se pudo cambiar el modo. Inténtalo de nuevo.";
  }

  return {
    status,
    message,
    currentMode: isMode(body?.currentMode) ? body.currentMode : null,
    unmet,
    groupUnmet,
    needsAckZeroDeny: has("venta_bloqueada"),
    needsAckMultiLocation: has("ubicaciones_online"),
    needsGroup: has("almacen_compartido"),
    zeroDenyCount: zeroDeny === undefined || zeroDeny === null ? null : n(zeroDeny),
  };
}

// ===== Reporte a pedido =====

export type RunRequestFailure =
  | { kind: "running"; runningRunId: string | null; message: string }
  | { kind: "error"; message: string };

/** Lee el rechazo de «Generar reporte»: 409 = ya hay una corrida (de la tienda o la diaria). */
export function parseRunRequestError(error: unknown): RunRequestFailure {
  const status = httpStatus(error);
  const body = responseBody<{ message?: unknown; runningRunId?: unknown }>(error);
  if (status === 409) {
    const runningRunId = typeof body?.runningRunId === "string" ? body.runningRunId : null;
    return {
      kind: "running",
      runningRunId,
      message: runningRunId
        ? "Ya hay un reporte en curso para esta tienda: se muestra ese."
        : "Ya hay una actualización de stock en curso. Vuelve a intentarlo en unos minutos.",
    };
  }
  if (status === 403) return { kind: "error", message: "Solo un administrador de la empresa puede generar el reporte." };
  const detail = backendMessage(body as ModeErrorBody | undefined);
  return { kind: "error", message: detail ?? "No se pudo generar el reporte. Inténtalo de nuevo." };
}

export class StockRunPollTimeoutError extends Error {
  constructor(readonly runId: string) {
    super("El reporte sigue en curso. Vuelve a mirar en unos minutos.");
    this.name = "StockRunPollTimeoutError";
  }
}

export interface PollStockRunOptions {
  fetchRun: (runId: string) => Promise<ShopifyStockRunState>;
  intervalMs?: number;
  timeoutMs?: number;
  /** Fallas seguidas de la consulta que se toleran antes de cortar. */
  maxConsecutiveErrors?: number;
  signal?: AbortSignal;
  onUpdate?: (run: ShopifyStockRun) => void;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
}

export const STOCK_RUN_POLL_INTERVAL_MS = 3_000;
export const STOCK_RUN_POLL_TIMEOUT_MS = 10 * 60_000;

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const abortError = () => {
  const err = new Error("Sondeo cancelado");
  err.name = "AbortError";
  return err;
};

/**
 * Consulta la corrida cada `intervalMs` hasta que deja de estar `running` y la devuelve. Tolera fallas
 * sueltas de la consulta; corta con `StockRunPollTimeoutError` pasado `timeoutMs` y con un `AbortError`
 * si se cancela.
 */
export async function pollStockRun(runId: string, options: PollStockRunOptions): Promise<ShopifyStockRun> {
  const {
    fetchRun,
    intervalMs = STOCK_RUN_POLL_INTERVAL_MS,
    timeoutMs = STOCK_RUN_POLL_TIMEOUT_MS,
    maxConsecutiveErrors = 3,
    signal,
    onUpdate,
    sleep = defaultSleep,
    now = Date.now,
  } = options;
  const started = now();
  let failures = 0;
  for (;;) {
    if (signal?.aborted) throw abortError();
    try {
      const { run } = await fetchRun(runId);
      failures = 0;
      onUpdate?.(run);
      if (run.status !== "running") return run;
    } catch (err) {
      failures += 1;
      if (failures >= maxConsecutiveErrors) throw err;
    }
    if (now() - started >= timeoutMs) throw new StockRunPollTimeoutError(runId);
    await sleep(intervalMs);
  }
}

// ===== Otras ayudas =====

/** Otras tiendas activas de la empresa con el mismo almacén que no están en «Powip manda» (pasan juntas). */
export function sharedWarehouseSiblings(shop: ShopifyStockShop, shops: ShopifyStockShop[]): ShopifyStockShop[] {
  if (!shop.inventoryId) return [];
  return shops.filter(
    (s) => s.id !== shop.id && s.isActive && s.inventoryId === shop.inventoryId && s.stockMode !== "powip",
  );
}

/**
 * FEAT-24 SEC — la URL que devuelve `POST /shopify/auth-url` tiene que ser la pantalla de permisos de ESA
 * tienda (`https://<tienda>/admin/oauth/authorize`): si no, no se navega.
 */
export function isShopifyAuthorizeUrl(url: unknown, shop: string): url is string {
  if (typeof url !== "string") return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && parsed.hostname === shop && parsed.pathname === "/admin/oauth/authorize";
  } catch {
    return false;
  }
}

/** Mensaje del rechazo de «Volver a autorizar en Shopify» (`POST /shopify/auth-url`). */
export function parseAuthUrlError(error: unknown): string {
  const status = httpStatus(error);
  const detail = backendMessage(responseBody<ModeErrorBody>(error));
  if (status === 401) return "Tu sesión venció. Vuelve a iniciar sesión.";
  if (status === 403) return detail ?? "Solo un administrador de la empresa puede volver a autorizar la tienda.";
  return detail ?? "No se pudo abrir la autorización de Shopify. Inténtalo de nuevo.";
}

/**
 * Mensaje del rechazo de una sincronización manual con Shopify (`POST /shopify/sync/:tienda`, `POST /shopify/sync`,
 * `POST /shopify/confirm-sync/:tienda`). FEAT-24 SEC: piden la sesión de un administrador de la empresa de la tienda.
 */
export function parseShopifySyncError(error: unknown, fallback: string): string {
  const status = httpStatus(error);
  if (status === 401) return "Tu sesión venció. Vuelve a iniciar sesión.";
  if (status === 403) return "Solo un administrador de la empresa puede sincronizar con Shopify.";
  if (status === 404) return "Esa tienda de Shopify no está conectada a tu empresa.";
  return fallback;
}

/** Clave numérica de una ubicación de Shopify (gid o número); null si no es una ubicación. */
export function locationKey(id: string | null | undefined): string | null {
  if (typeof id !== "string") return null;
  const text = id.trim();
  if (/^\d+$/.test(text)) return text;
  const match = /^gid:\/\/shopify\/Location\/(\d+)$/.exec(text);
  return match ? match[1] : null;
}

/** La ubicación guardada dentro de una lista (por clave, gid o número). */
export function findLocation(locations: ShopifyLocation[], id: string | null | undefined): ShopifyLocation | null {
  const key = locationKey(id);
  if (!key) return null;
  return locations.find((l) => (locationKey(l.id) ?? l.legacyId) === key) ?? null;
}

const DATE_TIME = new Intl.DateTimeFormat("es-PE", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Lima",
});

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "—" : DATE_TIME.format(date);
}
