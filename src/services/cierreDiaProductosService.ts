import { getPedidosCC, getUpsellRecords, PedidosCcFilters } from "@/services/atencionClienteService";
import { OrderHeader, OrderStatus } from "@/interfaces/IOrder";
import { CierreDiaFunnel, CierreDiaProductoRow } from "@/interfaces/ICierreDia";
import { EMPTY_FUNNEL } from "@/utils/cierreDiaFunnel";

/**
 * Todo lo "en vivo" del Cierre del Día — a diferencia del resto del módulo
 * (que se guarda manualmente), esto se calcula cruzando datos reales:
 *  - `getPedidosCC` (embudo real por pedido vía status/subEstadoCc)
 *  - `GET {NEXT_PUBLIC_API_PRODUCTOS}/product-variant/{id}` → priceBase como costo
 *    (mismo patrón que `administracion/margen-producto/page.tsx`)
 *  - `getUpsellRecords` para unidades/monto de upsell (por SKU y por pedido)
 *
 * Se usa para dos cosas con distinta unidad de conteo, calculadas en el mismo
 * recorrido de pedidos para no duplicar llamadas:
 *  - `rows`/`totals`: por PRODUCTO, embudo en unidades vendidas.
 *  - `byDay`: por DÍA, embudo en cantidad de PEDIDOS — es lo que autocompleta
 *    el Cierre del Día cuando todavía no se guardó manualmente.
 *
 * El bucket categoría no se incluye: el endpoint de variante no trae
 * categoría y resolverla exigiría otra llamada por producto (variante → producto
 * → categoría) que no se pudo probar contra el backend real.
 */

const DESPACHO_STATUSES: OrderStatus[] = ["ASIGNADO_A_GUIA", "EN_ENVIO"];
const MAX_PAGES = 20; // resguardo ante paginación mal formada del backend

/**
 * subEstadoCc es terminal en "confirmado" / "anulado_cc" (ver
 * CcGestionPanel.TERMINAL_STATES) — una vez confirmado el avance a
 * despachado/entregado se seguiría por order.status, no por subEstadoCc.
 * Este mapeo se infirió leyendo el código de transición de estados
 * (CcGestionPanel.tsx, ventas/page.tsx) — no se pudo validar contra datos
 * reales de producción. Ajustar acá si difiere del comportamiento real.
 */
export function mapOrderToFunnelBucket(
  order: Pick<OrderHeader, "status" | "subEstadoCc">,
): keyof CierreDiaFunnel {
  if (order.status === "ANULADO" || order.subEstadoCc === "anulado_cc") return "anulado";
  if (order.status === "ENTREGADO") return "entregado";
  if (DESPACHO_STATUSES.includes(order.status)) return "despachado";
  if (order.subEstadoCc === "confirmado") return "confirmado";
  if (order.subEstadoCc === "no_contesta") return "noContesta";
  if (order.subEstadoCc === "contactado") return "contactado";
  return "porConfirmar";
}

function esFacturable(bucket: keyof CierreDiaFunnel): boolean {
  return bucket === "confirmado" || bucket === "despachado" || bucket === "entregado";
}

/** Convierte un ISO (UTC) a fecha local YYYY-MM-DD — mismo criterio que usan las vistas. */
function toLocalDateStr(iso: string): string {
  const d = new Date(iso);
  const tz = d.getTimezoneOffset();
  return new Date(d.getTime() - tz * 60000).toISOString().slice(0, 10);
}

/** Límites ISO de un solo día local (para la vista Día). */
export function isoDayBounds(date: string): { startDate: string; endDate: string } {
  return {
    startDate: new Date(`${date}T00:00:00`).toISOString(),
    endDate: new Date(`${date}T23:59:59`).toISOString(),
  };
}

/** Límites ISO entre dos fechas YYYY-MM-DD (para Rango / Mes). */
export function isoRangeBounds(startDate: string, endDate: string): { startDate: string; endDate: string } {
  return {
    startDate: new Date(`${startDate}T00:00:00`).toISOString(),
    endDate: new Date(`${endDate}T23:59:59`).toISOString(),
  };
}

async function fetchAllPedidosCC(filters: PedidosCcFilters): Promise<OrderHeader[]> {
  const limit = 200;
  let page = 1;
  let all: OrderHeader[] = [];
  while (page <= MAX_PAGES) {
    const res = await getPedidosCC({ ...filters, page, limit });
    all = all.concat(res.data);
    if (res.data.length === 0 || page >= res.totalPages) break;
    page += 1;
  }
  return all;
}

async function fetchVariantCost(variantId: string): Promise<number> {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_PRODUCTOS}/product-variant/${variantId}`);
    if (!res.ok) return 0;
    const data = await res.json();
    return Number(data?.priceBase ?? 0);
  } catch {
    return 0;
  }
}

interface Accumulator {
  productVariantId: string;
  nombre: string;
  sku: string;
  buckets: CierreDiaFunnel;
  ingreso: number;
  unidadesFacturables: number; // unidades en confirmado+despachado+entregado — base del costo
}

interface DayAccumulator {
  buckets: CierreDiaFunnel; // cantidad de PEDIDOS por bucket (no unidades)
  ingreso: number;
  upsells: number;
  variantUnits: Map<string, number>; // unidades facturables por variante — base del costo del día
}

export interface CierreDiaUpsellSummary {
  pedidosConfirmados: number;
  pedidosConUpsell: number;
  pctConversion: number;
  ingresoExtra: number;
  ticketSinUpsell: number;
  ticketConUpsell: number;
  pctIncremento: number;
}

/** Embudo + financiero de UN día, calculado en vivo a partir de pedidos reales. */
export interface CierreDiaDayTotals extends CierreDiaFunnel {
  date: string; // YYYY-MM-DD
  ingreso: number;
  costo: number;
  upsells: number;
}

export interface CierreDiaClosingData {
  rows: CierreDiaProductoRow[];
  totals: CierreDiaProductoRow;
  upsellSummary: CierreDiaUpsellSummary;
  byDay: CierreDiaDayTotals[]; // ordenado por fecha ascendente
}

/**
 * Trae y agrega todo lo que necesitan las secciones "en vivo" del Cierre del
 * Día (tabla de productos, resumen de upsell y auto-completado por día) para
 * un rango de fechas. `startDate`/`endDate` deben venir en ISO datetime (ver
 * `isoDayBounds` / `isoRangeBounds`).
 */
export async function getCierreDiaClosingData(
  storeId: string,
  startDate: string,
  endDate: string,
): Promise<CierreDiaClosingData> {
  const [orders, upsell] = await Promise.all([
    fetchAllPedidosCC({ storeId, tipoGestion: "cod", startDate, endDate }),
    getUpsellRecords(storeId, startDate, endDate).catch(() => null),
  ]);

  const upsellBySku = new Map<string, number>();
  const upsellOrderNumbers = new Set<string>();
  let ingresoExtraUpsell = 0;
  upsell?.items.forEach((it) => {
    upsellBySku.set(it.sku, (upsellBySku.get(it.sku) ?? 0) + it.quantity);
    upsellOrderNumbers.add(it.orderNumber);
    ingresoExtraUpsell += it.subtotal;
  });

  const byVariant = new Map<string, Accumulator>();
  const byDayAcc = new Map<string, DayAccumulator>();
  const confirmados: OrderHeader[] = [];

  for (const order of orders) {
    const bucket = mapOrderToFunnelBucket(order);
    const facturable = esFacturable(bucket);
    if (facturable) confirmados.push(order);

    const orderDate = toLocalDateStr(order.created_at);
    if (!byDayAcc.has(orderDate)) {
      byDayAcc.set(orderDate, { buckets: { ...EMPTY_FUNNEL }, ingreso: 0, upsells: 0, variantUnits: new Map() });
    }
    const dayAcc = byDayAcc.get(orderDate)!;
    dayAcc.buckets[bucket] += 1; // conteo de PEDIDOS, no de unidades
    if (facturable && upsellOrderNumbers.has(order.orderNumber)) dayAcc.upsells += 1;

    for (const item of order.items ?? []) {
      const key = item.productVariantId;
      if (!byVariant.has(key)) {
        byVariant.set(key, {
          productVariantId: key,
          nombre: item.productName,
          sku: item.sku,
          buckets: { ...EMPTY_FUNNEL },
          ingreso: 0,
          unidadesFacturables: 0,
        });
      }
      const acc = byVariant.get(key)!;
      acc.buckets[bucket] += item.quantity;
      if (facturable) {
        acc.ingreso += Number(item.subtotal ?? 0);
        acc.unidadesFacturables += item.quantity;
        dayAcc.ingreso += Number(item.subtotal ?? 0);
        dayAcc.variantUnits.set(key, (dayAcc.variantUnits.get(key) ?? 0) + item.quantity);
      }
    }
  }

  const variantIds = [...byVariant.keys()];
  const costEntries = await Promise.all(
    variantIds.map(async (id) => [id, await fetchVariantCost(id)] as const),
  );
  const costMap = new Map(costEntries);

  const rows: CierreDiaProductoRow[] = variantIds
    .map((id) => {
      const acc = byVariant.get(id)!;
      const costoUnit = costMap.get(id) ?? 0;
      const costo = costoUnit * acc.unidadesFacturables;
      const margen = acc.ingreso - costo;
      return {
        productVariantId: id,
        nombre: acc.nombre,
        sku: acc.sku,
        ...acc.buckets,
        upsell: upsellBySku.get(acc.sku) ?? 0,
        ingreso: acc.ingreso,
        costo,
        margen,
        pctMargen: acc.ingreso ? (margen / acc.ingreso) * 100 : 0,
      };
    })
    .sort((a, b) => b.ingreso - a.ingreso);

  const totals: CierreDiaProductoRow = rows.reduce(
    (acc, r) => ({
      ...acc,
      porConfirmar: acc.porConfirmar + r.porConfirmar,
      contactado: acc.contactado + r.contactado,
      noContesta: acc.noContesta + r.noContesta,
      confirmado: acc.confirmado + r.confirmado,
      despachado: acc.despachado + r.despachado,
      entregado: acc.entregado + r.entregado,
      anulado: acc.anulado + r.anulado,
      upsell: acc.upsell + r.upsell,
      ingreso: acc.ingreso + r.ingreso,
      costo: acc.costo + r.costo,
      margen: acc.margen + r.margen,
    }),
    {
      productVariantId: "TOTAL",
      nombre: "TOTAL",
      sku: "",
      ...EMPTY_FUNNEL,
      upsell: 0,
      ingreso: 0,
      costo: 0,
      margen: 0,
      pctMargen: 0,
    },
  );
  totals.pctMargen = totals.ingreso ? (totals.margen / totals.ingreso) * 100 : 0;

  const byDay: CierreDiaDayTotals[] = [...byDayAcc.entries()]
    .map(([date, acc]) => {
      let costo = 0;
      acc.variantUnits.forEach((qty, variantId) => {
        costo += (costMap.get(variantId) ?? 0) * qty;
      });
      return { date, ...acc.buckets, ingreso: acc.ingreso, costo, upsells: acc.upsells };
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  const conUpsell = confirmados.filter((o) => upsellOrderNumbers.has(o.orderNumber));
  const sinUpsell = confirmados.filter((o) => !upsellOrderNumbers.has(o.orderNumber));
  const avgTicket = (list: OrderHeader[]) =>
    list.length ? list.reduce((s, o) => s + Number(o.grandTotal ?? 0), 0) / list.length : 0;
  const ticketSinUpsell = avgTicket(sinUpsell);
  const ticketConUpsell = avgTicket(conUpsell);

  const upsellSummary: CierreDiaUpsellSummary = {
    pedidosConfirmados: confirmados.length,
    pedidosConUpsell: conUpsell.length,
    pctConversion: confirmados.length ? (conUpsell.length / confirmados.length) * 100 : 0,
    ingresoExtra: ingresoExtraUpsell,
    ticketSinUpsell,
    ticketConUpsell,
    pctIncremento: ticketSinUpsell ? ((ticketConUpsell - ticketSinUpsell) / ticketSinUpsell) * 100 : 0,
  };

  return { rows, totals, upsellSummary, byDay };
}
