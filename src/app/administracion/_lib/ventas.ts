/**
 * Definición única de «venta» para todo Administración (FEAT-34).
 *
 * - Venta = pedido ENTREGADO que no es LEAD.
 * - Monto = `grandTotal` (ya incluye IGV: el 99,97 % de los pedidos es `taxMode = INCLUIDO`).
 * - Unidades = Σ `quantity` de las líneas de producto (sin servicios). Antes se contaban pedidos o líneas.
 * - Costo = Σ `unitCost × quantity` de las líneas (pisado con el costo real al despachar); si falta en alguna línea,
 *   el `costAmount` del pedido. Si ninguno lo trae, la venta queda «sin costo» y se avisa en pantalla.
 * - Fecha de la venta = día de creación en hora Lima (el filtro del backend). Ya no se usa `updated_at`, que cambia
 *   con cualquier edición. La Fase 2 pasa a la fecha de entrega.
 * - En tránsito = ASIGNADO_A_GUIA + EN_ENVIO + DESPACHADO (antes solo DESPACHADO).
 */

import { isCommercialSale } from "@/utils/commercialOrderReporting";
import { canalDePedido } from "./canales";
import { type DiaKey, diaLima } from "./periodo";

type Numerico = number | string | null | undefined;

export interface LineaPedido {
  lineKind?: string | null;
  quantity?: Numerico;
  unitCost?: Numerico;
  unitPrice?: Numerico;
  subtotal?: Numerico;
  sku?: string | null;
  productName?: string | null;
  productVariantId?: string | null;
  categoryName?: string | null;
}

export interface PagoPedido {
  status?: string | null;
  amount?: Numerico;
}

export interface PedidoAdmin {
  id?: string;
  status?: string | null;
  commercialStage?: string | null;
  grandTotal?: Numerico;
  costAmount?: Numerico;
  channelFee?: Numerico;
  carrierShippingCost?: Numerico;
  salesChannel?: string | null;
  courier?: string | null;
  storeId?: string | null;
  created_at?: string | null;
  items?: LineaPedido[] | null;
  payments?: PagoPedido[] | null;
}

export const ESTADOS_EN_TRANSITO = ["ASIGNADO_A_GUIA", "EN_ENVIO", "DESPACHADO"] as const;

export function num(valor: Numerico): number {
  const n = Number(valor);
  return Number.isFinite(n) ? n : 0;
}

export function esVenta(pedido: PedidoAdmin | null | undefined): boolean {
  return !!pedido && isCommercialSale(pedido) && pedido.status === "ENTREGADO";
}

export function soloVentas<T extends PedidoAdmin>(pedidos: T[] | null | undefined): T[] {
  return (pedidos ?? []).filter(esVenta);
}

export function montoVenta(pedido: PedidoAdmin): number {
  return num(pedido.grandTotal);
}

const lineasProducto = (pedido: PedidoAdmin) =>
  (pedido.items ?? []).filter((linea) => linea.lineKind !== "SERVICE");

export function unidadesPedido(pedido: PedidoAdmin): number {
  return lineasProducto(pedido).reduce((s, linea) => s + num(linea.quantity), 0);
}

/**
 * Costo de producto del pedido, o null («sin costo»):
 * - todas las líneas con costo → Σ costo de las líneas;
 * - ninguna línea con costo y cabecera > 0 → la cabecera (pedidos viejos, con el costo solo en `costAmount`);
 * - costo parcial en las líneas → null: la cabecera ya no sirve, porque ms-ventas la recalcula como Σ de las líneas
 *   (las que no tienen costo suman 0) y daría un costo menor al real sin avisar (FEAT-34 2.3).
 */
export function costoPedido(pedido: PedidoAdmin): number | null {
  const lineas = lineasProducto(pedido);
  const conCosto = lineas.filter((linea) => num(linea.unitCost) > 0);
  if (lineas.length > 0 && conCosto.length === lineas.length) {
    return lineas.reduce((s, linea) => s + num(linea.unitCost) * num(linea.quantity), 0);
  }
  if (conCosto.length > 0) return null;
  const cabecera = num(pedido.costAmount);
  return cabecera > 0 ? cabecera : null;
}

/**
 * Costo dudoso: el costo de la línea es igual o mayor que su precio de lista. Casi siempre es el precio de venta
 * guardado como «precio base» de la variante (la sincronización de Shopify lo hacía hasta el 17-11-2026): medido el
 * 26-11 en prod, el 92 % del costo de noviembre estaba así. Se cuenta igual (es lo que hay cargado) y se avisa.
 */
export function costoDudosoLinea(linea: LineaPedido): boolean {
  const costo = num(linea.unitCost);
  const precio = num(linea.unitPrice);
  return costo > 0 && precio > 0 && costo >= precio;
}

/** El costo del pedido es dudoso: alguna línea con costo ≥ precio o, si el costo es el de la cabecera, ≥ el total. */
export function costoDudosoPedido(pedido: PedidoAdmin): boolean {
  const lineas = lineasProducto(pedido);
  if (lineas.some((linea) => num(linea.unitCost) > 0)) {
    return lineas.some(costoDudosoLinea);
  }
  const cabecera = num(pedido.costAmount);
  const total = montoVenta(pedido);
  return cabecera > 0 && total > 0 && cabecera >= total;
}

export function pagadoPedido(pedido: PedidoAdmin): number {
  return (pedido.payments ?? [])
    .filter((pago) => pago.status === "PAID")
    .reduce((s, pago) => s + num(pago.amount), 0);
}

/** Lo que falta cobrar del pedido (nunca negativo). */
export function saldoPedido(pedido: PedidoAdmin): number {
  return Math.max(0, montoVenta(pedido) - pagadoPedido(pedido));
}

export function estaEnTransito(pedido: PedidoAdmin): boolean {
  return (
    isCommercialSale(pedido) &&
    (ESTADOS_EN_TRANSITO as readonly string[]).includes(pedido.status ?? "")
  );
}

/** Día de la venta (creación, hora Lima). */
export function diaVenta(pedido: PedidoAdmin): DiaKey | null {
  return diaLima(pedido.created_at);
}

export function mesVenta(pedido: PedidoAdmin): { anio: number; mes: number } | null {
  const dia = diaVenta(pedido);
  if (!dia) return null;
  return { anio: Number(dia.slice(0, 4)), mes: Number(dia.slice(5, 7)) };
}

/** Pedidos (de cualquier estado) creados entre dos días de Lima. */
export function delPeriodo<T extends PedidoAdmin>(pedidos: T[] | null | undefined, desde: DiaKey, hasta: DiaKey): T[] {
  return (pedidos ?? []).filter((pedido) => {
    const dia = diaVenta(pedido);
    return !!dia && dia >= desde && dia <= hasta;
  });
}

export interface ResumenVentas {
  pedidos: number;
  monto: number;
  unidades: number;
  /** Costo de las ventas que lo tienen cargado. */
  costo: number;
  comisiones: number;
  sinCosto: { pedidos: number; monto: number };
  /** Ventas con costo dudoso (`costoDudosoPedido`) y lo que se vendió en ellas. */
  costoDudoso: { pedidos: number; monto: number };
  /** Fracción del monto vendido que tiene costo (0..1), null si no hay ventas. */
  coberturaCosto: number | null;
  ticketPromedio: number | null;
}

export function resumirVentas(pedidos: PedidoAdmin[] | null | undefined): ResumenVentas {
  const ventas = soloVentas(pedidos);
  let monto = 0;
  let unidades = 0;
  let costo = 0;
  let comisiones = 0;
  let sinCostoPedidos = 0;
  let sinCostoMonto = 0;
  let dudosoPedidos = 0;
  let dudosoMonto = 0;
  for (const venta of ventas) {
    const total = montoVenta(venta);
    monto += total;
    unidades += unidadesPedido(venta);
    comisiones += num(venta.channelFee);
    const c = costoPedido(venta);
    if (c === null) {
      sinCostoPedidos += 1;
      sinCostoMonto += total;
    } else {
      costo += c;
      if (costoDudosoPedido(venta)) {
        dudosoPedidos += 1;
        dudosoMonto += total;
      }
    }
  }
  return {
    pedidos: ventas.length,
    monto,
    unidades,
    costo,
    comisiones,
    sinCosto: { pedidos: sinCostoPedidos, monto: sinCostoMonto },
    costoDudoso: { pedidos: dudosoPedidos, monto: dudosoMonto },
    coberturaCosto: monto > 0 ? (monto - sinCostoMonto) / monto : null,
    ticketPromedio: ventas.length > 0 ? monto / ventas.length : null,
  };
}

/** Ventas agrupadas por canal (clave normalizada). */
export function ventasPorCanal(pedidos: PedidoAdmin[] | null | undefined): Map<string, ResumenVentas> {
  const grupos = new Map<string, PedidoAdmin[]>();
  for (const venta of soloVentas(pedidos)) {
    const clave = canalDePedido(venta);
    grupos.set(clave, [...(grupos.get(clave) ?? []), venta]);
  }
  return new Map([...grupos.entries()].map(([clave, lista]) => [clave, resumirVentas(lista)]));
}

/** Ventas agrupadas por día de Lima. */
export function ventasPorDia(pedidos: PedidoAdmin[] | null | undefined): Map<DiaKey, ResumenVentas> {
  const grupos = new Map<DiaKey, PedidoAdmin[]>();
  for (const venta of soloVentas(pedidos)) {
    const dia = diaVenta(venta);
    if (!dia) continue;
    grupos.set(dia, [...(grupos.get(dia) ?? []), venta]);
  }
  return new Map([...grupos.entries()].map(([dia, lista]) => [dia, resumirVentas(lista)]));
}
