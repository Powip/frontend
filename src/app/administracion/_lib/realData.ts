/**
 * Helpers para leer datos reales de ms-ventas (OrderHeader) en las pestañas
 * nuevas de Administración. Todo lo que vive acá es real — a diferencia de
 * `_mock/data.ts`, que sigue alimentando lo que no tiene fuente real todavía
 * (inversión de pauta, capital, metas, vendedoras).
 *
 * Nota importante: el `SalesChannel` real de ms-ventas
 * (`src/interfaces/IOrder.ts`) es más genérico que los "canales de venta"
 * que describe la doc técnica (§6, §8, §9: WhatsApp / Instagram / TikTok /
 * Web Pasarela / Web COD / Falabella / Mercado Libre / Ripley, cada uno con
 * su propio modelo de cobro). Hoy solo existen 7 valores:
 * TIENDA_FISICA | WHATSAPP | INSTAGRAM | FACEBOOK | MARKETPLACE | MERCADOLIBRE | OTRO
 * — no hay TikTok, ni Falabella/Ripley por separado, ni forma de distinguir
 * Web con pasarela de Web COD. Control diario y Pauta por canal usan esta
 * lista real en vez de la del mockup.
 */

export interface CanalReal {
  id: string;
  nombre: string;
  grupo: "ecommerce" | "marketplace";
}

export const CANALES_REALES: CanalReal[] = [
  { id: "WHATSAPP", nombre: "WhatsApp", grupo: "ecommerce" },
  { id: "INSTAGRAM", nombre: "Instagram", grupo: "ecommerce" },
  { id: "FACEBOOK", nombre: "Facebook", grupo: "ecommerce" },
  { id: "TIENDA_FISICA", nombre: "Tienda física", grupo: "ecommerce" },
  { id: "MARKETPLACE", nombre: "Marketplace", grupo: "marketplace" },
  { id: "MERCADOLIBRE", nombre: "Mercado Libre", grupo: "marketplace" },
  { id: "OTRO", nombre: "Otro", grupo: "ecommerce" },
];

/** Pedidos reconocidos como venta real — COD: ENTREGADO (§3 doc). */
export function soloEntregados(orders: any[]): any[] {
  return (orders ?? []).filter((o) => o.status === "ENTREGADO");
}

/** Suma de pagos con status PAID — mismo criterio que `operaciones/liquidaciones`. */
export function paidAmount(order: any): number {
  return (order.payments ?? [])
    .filter((p: any) => p.status === "PAID")
    .reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);
}

export function fechaOrden(o: any): Date {
  return new Date(o.updated_at ?? o.created_at ?? Date.now());
}

/** Agrupa pedidos ENTREGADO por canal real, con ventas (grandTotal) y unidades (itemCount). */
export function agruparPorCanal(orders: any[]): Record<string, { ventas: number; unidades: number; pedidos: number }> {
  const grouped: Record<string, { ventas: number; unidades: number; pedidos: number }> = {};
  for (const o of soloEntregados(orders)) {
    const canal = (o.salesChannel || "OTRO") as string;
    if (!grouped[canal]) grouped[canal] = { ventas: 0, unidades: 0, pedidos: 0 };
    grouped[canal].ventas += Number(o.grandTotal || 0);
    grouped[canal].unidades += o.itemCount || (Array.isArray(o.items) ? o.items.length : 1);
    grouped[canal].pedidos += 1;
  }
  return grouped;
}

/** Agrupa pedidos ENTREGADO de un canal por día del mes (1-31). */
export function agruparPorDia(orders: any[], canal: string, mes: number, anio: number) {
  const dias: Record<number, { ordenes: number; unidades: number; venta: number }> = {};
  for (const o of soloEntregados(orders)) {
    if ((o.salesChannel || "OTRO") !== canal) continue;
    const f = fechaOrden(o);
    if (f.getMonth() + 1 !== mes || f.getFullYear() !== anio) continue;
    const dia = f.getDate();
    if (!dias[dia]) dias[dia] = { ordenes: 0, unidades: 0, venta: 0 };
    dias[dia].ordenes += 1;
    dias[dia].unidades += o.itemCount || (Array.isArray(o.items) ? o.items.length : 1);
    dias[dia].venta += Number(o.grandTotal || 0);
  }
  return dias;
}

export interface VentaProductoReal {
  sku: string;
  nombre: string;
  ventas: number;
  unidades: number;
}

/**
 * Ventas por producto dentro de un canal — real, a partir de `OrderItem`
 * (`sku`, `productName`, `quantity`, `subtotal`). No existe `categoria` en
 * `OrderItem` (eso vive en ms-products, sin endpoint expuesto acá), así que
 * la atribución por categoría en Pauta por canal se mantiene manual.
 */
export function ventasPorProductoEnCanal(orders: any[], canal: string): VentaProductoReal[] {
  const map: Record<string, VentaProductoReal> = {};
  for (const o of soloEntregados(orders)) {
    if ((o.salesChannel || "OTRO") !== canal) continue;
    for (const item of o.items ?? []) {
      const sku = item.sku || item.productVariantId || "SIN-SKU";
      if (!map[sku]) map[sku] = { sku, nombre: item.productName || sku, ventas: 0, unidades: 0 };
      map[sku].ventas += Number(item.subtotal || 0);
      map[sku].unidades += Number(item.quantity || 0);
    }
  }
  return Object.values(map).sort((a, b) => b.ventas - a.ventas);
}

/** Pedidos en tránsito (courier ya salió, aún no ENTREGADO) — base real de "Saldos COD en tránsito". */
export function enTransito(orders: any[]): any[] {
  return (orders ?? []).filter((o) => o.status === "EN_ENVIO" || o.status === "ASIGNADO_A_GUIA");
}

/**
 * Agrupa pedidos ENTREGADO con courier asignado por courier — misma lógica
 * que `buildGuiasPorLiquidar` en `operaciones/liquidaciones/_components/utils.ts`,
 * pero a nivel courier (no por guía individual) para la card de Liquidaciones.
 */
export function agruparPorCourier(orders: any[]) {
  const map: Record<string, { nombre: string; guias: number; recaudado: number; adelantos: number; neto: number; diasMax: number }> = {};
  for (const o of soloEntregados(orders)) {
    const courier = (o.courier || "").trim();
    if (!courier) continue;
    if (!map[courier]) map[courier] = { nombre: courier, guias: 0, recaudado: 0, adelantos: 0, neto: 0, diasMax: 0 };
    const bruto = Number(o.grandTotal || 0);
    const adelantos = paidAmount(o);
    map[courier].guias += 1;
    map[courier].recaudado += bruto;
    map[courier].adelantos += adelantos;
    map[courier].neto += Math.max(0, bruto - adelantos);
    const dias = Math.max(0, Math.floor((Date.now() - fechaOrden(o).getTime()) / 86400000));
    map[courier].diasMax = Math.max(map[courier].diasMax, dias);
  }
  return Object.values(map).filter((c) => c.neto > 0);
}
