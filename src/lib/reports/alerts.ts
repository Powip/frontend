import { suggestedPurchaseHref } from "@/lib/suggestedPurchase";
import { formatVariantLabel } from "@/lib/variantAttributes";
import type {
  InventoryAlert,
  InventoryAlerts,
  LowStockAlertItem,
  OldReservationAlertItem,
  OutOfStockAlertItem,
  PendingReturnAlertItem,
} from "@/services/inventoryReportsService";
import { formatYmd } from "./periods";

// FEAT-24 H10-D8 — alertas de inventario (mockup vAlertas): cada alerta con su
// tipo, el detalle y un enlace a la pantalla que la resuelve. Funciones puras.

export type AlertTone = "red" | "amber" | "slate";

export interface AlertRow {
  key: string;
  type: string;
  tone: AlertTone;
  title: string;
  description: string;
  href: string;
  action: string;
}

interface AlertMeta {
  title: string;
  tone: AlertTone;
  href: string;
  action: string;
}

export const ALERT_META: Record<string, AlertMeta> = {
  bajo_minimo: { title: "Bajo mínimo", tone: "amber", href: "/compras", action: "Crear compra" },
  sin_stock_con_pedidos: { title: "Pedido sin stock", tone: "red", href: "/inventario/pedidos-sin-stock", action: "Gestionar" },
  reservas_viejas: { title: "Reserva vieja", tone: "amber", href: "/operaciones/pedidos", action: "Ver pedidos" },
  devoluciones_por_recibir: { title: "Devolución sin recibir", tone: "amber", href: "/inventario/recepciones", action: "Recibir" },
  sku_por_vincular: { title: "SKU por vincular", tone: "slate", href: "/inventario/unificacion", action: "Vincular" },
  lotes_por_vencer: { title: "Lotes por vencer", tone: "amber", href: "/inventario/alertas#vencimiento", action: "Ver vencimientos" },
  investigacion_vencida: { title: "Investigación vencida", tone: "slate", href: "/inventario/stock", action: "Revisar" },
  conciliacion_con_diferencia: { title: "Courier no cuadra", tone: "amber", href: "/inventario/stock", action: "Conciliar" },
  packs_bajo_margen: { title: "Pack bajo margen", tone: "slate", href: "/productos", action: "Revisar pack" },
  // FEAT-24 H5-L: los dos llevan a «Vencimiento en dinero», en esta misma pantalla.
  lotes_vencidos_con_stock: { title: "Lote vencido con stock", tone: "red", href: "/inventario/alertas#vencimiento", action: "Ver vencimientos" },
};

const metaOf = (type: string): AlertMeta => ALERT_META[type] ?? { title: type, tone: "slate", href: "/inventario/stock", action: "Ver" };

/** Adónde lleva el botón: el atajo que trae la alerta (H13: «Bajo mínimo» → pedido sugerido) o la pantalla de su tipo. */
export function alertHref(alert: Pick<InventoryAlert, "type" | "action">): string {
  if (alert.action?.type === "suggested_purchase") return suggestedPurchaseHref(alert.action.params);
  return metaOf(alert.type).href;
}

const days = (value: number | null | undefined) => (value === null || value === undefined ? "" : value === 1 ? "1 día" : `${value} días`);

/** Número legible del pedido: el que resolvió ventas o «Pedido». */
const orderText = (orderId: string, orderNumbers: Record<string, string>) => orderNumbers[orderId] ?? "Pedido";

interface RowsContext {
  orderNumbers: Record<string, string>;
  warehouseName: (id: string) => string;
  /** FEAT-24 H5-L: nombre de la variante (las alertas de lotes solo traen `variantId`). */
  variantName: (variantId: string) => string | undefined;
}

function rowsOf(alert: InventoryAlert, ctx: RowsContext): AlertRow[] {
  const meta = metaOf(alert.type);
  const href = alertHref(alert);
  const base = (key: string, description: string, overrides: Partial<AlertRow> = {}): AlertRow => ({
    key: `${alert.type}:${key}`,
    type: alert.type,
    tone: meta.tone,
    title: meta.title,
    description,
    href,
    action: meta.action,
    ...overrides,
  });
  switch (alert.type) {
    case "bajo_minimo":
      return (alert.items as LowStockAlertItem[]).map((item) => {
        const attributes = formatVariantLabel(item.attributes);
        const name = [item.productName || "Variante", attributes].filter(Boolean).join(" · ");
        const where = item.inventoryName || ctx.warehouseName(item.inventoryId);
        return base(
          `${item.inventoryId}:${item.variantId}`,
          `${name}${item.sku ? ` (${item.sku})` : ""} en ${where}: ${item.available} disponible, mínimo ${item.minStock}.`,
          item.outOfStock ? { title: "Agotado", tone: "red" } : {},
        );
      });
    case "sin_stock_con_pedidos":
      return (alert.items as OutOfStockAlertItem[]).map((item) => {
        const units = item.lines.reduce((sum, line) => sum + (Number(line.quantity) || 0), 0);
        const age = days(item.ageDays);
        return base(item.orderId, `${orderText(item.orderId, ctx.orderNumbers)} en ${ctx.warehouseName(item.inventoryId)} espera ${units} und${age ? ` hace ${age}` : ""}.`);
      });
    case "reservas_viejas":
      return (alert.items as OldReservationAlertItem[]).map((item) => {
        const age = days(item.ageDays);
        const release = item.releasesAt ? ` Se libera sola el ${formatYmd(item.releasesAt)}.` : "";
        return base(item.orderId, `${orderText(item.orderId, ctx.orderNumbers)} tiene stock reservado sin despachar${age ? ` hace ${age}` : ""}.${release}`);
      });
    case "devoluciones_por_recibir":
      return (alert.items as PendingReturnAlertItem[]).map((item) => {
        const age = days(item.ageDays);
        return base(item.id, `${item.orderNumber || orderText(item.orderId, ctx.orderNumbers)} · ${item.units} und por recibir en ${ctx.warehouseName(item.inventoryId)}${age ? ` hace ${age}` : ""}.`);
      });
    case "sku_por_vincular":
      return [
        base(
          "total",
          `${alert.count} ${alert.count === 1 ? "SKU de tus canales no está unido" : "SKU de tus canales no están unidos"} a una variante de POWIP. Las ventas con esos SKU no reservan stock.`,
        ),
      ];
    // FEAT-24 H5-L: un renglón por lote y almacén.
    case "lotes_por_vencer":
      return (alert.items as LotAlertItem[]).map((item) => {
        const left = item.daysToExpiry === null || item.daysToExpiry === undefined ? "" : item.daysToExpiry <= 0 ? " vencen hoy" : ` vencen en ${days(item.daysToExpiry)}`;
        const blocked = item.status === "bloqueado" ? " (bloqueado)" : "";
        return base(
          `${item.lotId}:${item.inventoryId}`,
          `${lotWhat(item, ctx)}${blocked} en ${item.inventoryName || ctx.warehouseName(item.inventoryId)}: ${item.quantity} und${left}. Véndelo primero, trasládalo o haz una promoción.`,
        );
      });
    case "lotes_vencidos_con_stock":
      return (alert.items as LotAlertItem[]).map((item) => {
        const ago = item.daysToExpiry !== null && item.daysToExpiry !== undefined && item.daysToExpiry < 0 ? ` hace ${days(-item.daysToExpiry)}` : "";
        return base(
          `${item.lotId}:${item.inventoryId}`,
          `${lotWhat(item, ctx)} en ${item.inventoryName || ctx.warehouseName(item.inventoryId)}: ${item.quantity} und vencidas${ago}. No se despachan: registra la merma.`,
        );
      });
    default:
      return alert.count > 0 ? [base("total", `${alert.count} por revisar.`)] : [];
  }
}

/**
 * Filas de la lista: solo las alertas encendidas y con algo. Si una alerta tiene más de lo que trajo la lista
 * corta, una fila final dice cuántas faltan.
 */
export function alertRows(
  data: InventoryAlerts,
  ctx: { orderNumbers?: Record<string, string>; warehouseName?: (id: string) => string; variantName?: (variantId: string) => string | undefined } = {},
): AlertRow[] {
  const context: RowsContext = {
    orderNumbers: ctx.orderNumbers ?? {},
    warehouseName: ctx.warehouseName ?? (() => "Almacén"),
    variantName: ctx.variantName ?? (() => undefined),
  };
  return data.alerts
    .filter((alert) => alert.enabled && alert.count > 0)
    .flatMap((alert) => {
      const rows = rowsOf(alert, context);
      const missing = alert.type === "sku_por_vincular" ? 0 : alert.count - rows.length;
      if (missing > 0) {
        const meta = metaOf(alert.type);
        rows.push({ key: `${alert.type}:more`, type: alert.type, tone: meta.tone, title: meta.title, description: `Y ${missing} más.`, href: alertHref(alert), action: meta.action });
      }
      return rows;
    });
}

/** Cuántas alertas hay de cada tipo encendido (para los chips del encabezado). */
export function alertCounts(data: InventoryAlerts): Array<{ type: string; title: string; tone: AlertTone; count: number }> {
  return data.alerts
    .filter((alert) => alert.enabled && alert.count > 0)
    .map((alert) => ({ type: alert.type, title: metaOf(alert.type).title, tone: metaOf(alert.type).tone, count: alert.count }));
}

/** Alertas apagadas hasta su hito (lotes, conciliaciones, packs…). */
export function upcomingAlerts(data: InventoryAlerts): string[] {
  return data.alerts.filter((alert) => !alert.enabled).map((alert) => metaOf(alert.type).title);
}

/** Pedidos de las alertas, para pedir sus números a ventas. */
export function alertOrderIds(data: InventoryAlerts): string[] {
  const ids = new Set<string>();
  for (const alert of data.alerts) {
    if (!["sin_stock_con_pedidos", "reservas_viejas", "devoluciones_por_recibir"].includes(alert.type)) continue;
    for (const item of alert.items as Array<{ orderId?: string; orderNumber?: string | null }>) {
      if (item.orderId && !item.orderNumber) ids.add(item.orderId);
    }
  }
  return [...ids].sort();
}

/** Texto del contador (badge): «99+» desde 100. */
export const alertBadgeText = (total: number): string => (total > 99 ? "99+" : String(total));

/* ---------------------------------------------------------------------------
   FEAT-24 H5-L — alertas de lotes
--------------------------------------------------------------------------- */

/** Ítem de `lotes_por_vencer` y `lotes_vencidos_con_stock`: lote × almacén con stock (sin nombre de producto). */
interface LotAlertItem {
  lotId: string;
  lotNumber: string;
  variantId: string;
  inventoryId: string;
  inventoryName?: string | null;
  daysToExpiry?: number | null;
  status?: string;
  quantity: number;
}

const LOT_ALERTS = ["lotes_por_vencer", "lotes_vencidos_con_stock"];

/** «Crema Centella · 50 ml · lote L2402» (o «Lote L2402» si todavía no se sabe el nombre). */
function lotWhat(item: LotAlertItem, ctx: RowsContext): string {
  const name = ctx.variantName(item.variantId);
  return name ? `${name} · lote ${item.lotNumber}` : `Lote ${item.lotNumber}`;
}

/** Variantes de las alertas de lotes, para pedir sus nombres al catálogo. */
export function alertLotVariantIds(data: InventoryAlerts): string[] {
  const ids = new Set<string>();
  for (const alert of data.alerts) {
    if (!LOT_ALERTS.includes(alert.type) || !alert.enabled) continue;
    for (const item of alert.items as Array<{ variantId?: string }>) if (item.variantId) ids.add(item.variantId);
  }
  return [...ids].sort();
}
