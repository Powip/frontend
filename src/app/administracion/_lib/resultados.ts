/**
 * Estado de resultados de Administración: una sola cuenta para Resumen, Utilidad, Punto de equilibrio, Reporte,
 * Flujo y Anual (FEAT-34). Todas las pestañas leen de acá, así que para el mismo periodo dan lo mismo.
 *
 *   Ventas (con IGV, como se cobran)
 * − Costo de producto (solo de las ventas que lo tienen cargado; se avisa cuánto falta)
 * − Merma
 * = Utilidad bruta
 * − Comisiones de canal (fee marketplace del pedido)
 * − Envíos (cotización de courier)
 * − Publicidad (consumo conectado + Gastos › Publicidad)
 * = Contribución
 * − Gastos fijos (planilla, herramientas, courier propio, otros), repartidos por días del periodo
 * = Utilidad operativa
 *
 * Decisiones de Octa (25-11-2026): sin «IGV/IR estimado» ni comisión Powip (D3, D4); gastos mensuales repartidos por
 * días (D8); publicidad de una sola fuente (D2).
 */

import type { CategoriaGasto, IGastoOperativo } from "@/interfaces/IAdmin";
import { type DiaKey, diasEntre, maxDia, mesesDelPeriodo, minDia, aDiaKey, diasDelMes } from "./periodo";
import type { ResumenVentas } from "./ventas";

export const CATEGORIAS_FIJAS = ["PLANILLA", "HERRAMIENTAS", "COURIER_PROPIO", "OTRO"] as const;
export type CategoriaFija = (typeof CATEGORIAS_FIJAS)[number];

export const NOMBRE_CATEGORIA: Record<CategoriaGasto, string> = {
  PLANILLA: "Planilla",
  HERRAMIENTAS: "Herramientas",
  PUBLICIDAD: "Publicidad",
  COURIER_PROPIO: "Courier propio",
  OTRO: "Otros",
  INVERSION: "Compra de mercadería",
};

export interface GastoProrrateado {
  gasto: IGastoOperativo;
  /** Parte del gasto mensual que le toca al periodo. */
  montoPeriodo: number;
  /** Días del periodo dentro del mes del gasto ÷ días del mes. */
  fraccion: number;
}

export interface ProrrateoGastos {
  filas: GastoProrrateado[];
  porCategoria: Record<CategoriaGasto, number>;
  /** Gastos fijos del periodo (sin PUBLICIDAD ni INVERSION). */
  fijos: number;
  publicidad: number;
  /** Compra de mercadería: no entra al resultado (ya está en el costo de producto). */
  inversion: number;
}

const categoriasEnCero = (): Record<CategoriaGasto, number> => ({
  PLANILLA: 0,
  HERRAMIENTAS: 0,
  PUBLICIDAD: 0,
  COURIER_PROPIO: 0,
  OTRO: 0,
  INVERSION: 0,
});

/**
 * Reparte cada gasto mensual por los días del periodo que caen en su mes: con «Últimos 7 días» le toca 7/30 de
 * noviembre, no noviembre entero. ms-company devuelve los meses completos que toca el rango.
 */
export function prorratearGastos(
  gastos: IGastoOperativo[] | null | undefined,
  desde: DiaKey,
  hasta: DiaKey,
): ProrrateoGastos {
  const tramos = mesesDelPeriodo(desde, hasta);
  const porCategoria = categoriasEnCero();
  const filas: GastoProrrateado[] = [];
  for (const gasto of gastos ?? []) {
    const tramo = tramos.find((t) => t.anio === Number(gasto.anio) && t.mes === Number(gasto.mes));
    if (!tramo) continue;
    const fraccion = tramo.dias / tramo.diasMes;
    const montoPeriodo = (Number(gasto.monto) || 0) * fraccion;
    filas.push({ gasto, montoPeriodo, fraccion });
    porCategoria[gasto.categoria] = (porCategoria[gasto.categoria] ?? 0) + montoPeriodo;
  }
  const fijos = CATEGORIAS_FIJAS.reduce((s, c) => s + porCategoria[c], 0);
  return { filas, porCategoria, fijos, publicidad: porCategoria.PUBLICIDAD, inversion: porCategoria.INVERSION };
}

export interface EntradaResultados {
  ventas: ResumenVentas;
  gastos: ProrrateoGastos;
  merma: number;
  envios: number;
  /** Consumo publicitario de las cuentas conectadas (PEN); null si no hay dato (sin permiso, sin servicio…). */
  publicidadConectada: number | null;
  /** Tasa de IGV de la empresa en %, para mostrar las ventas sin IGV. */
  igvPct: number;
}

export interface Resultados {
  pedidos: number;
  unidades: number;
  ventas: number;
  ventasSinIgv: number;
  igvIncluido: number;
  costoProducto: number;
  merma: number;
  utilidadBruta: number;
  margenBruto: number | null;
  comisiones: number;
  envios: number;
  publicidad: { conectada: number | null; gastos: number; total: number };
  gastosVariables: number;
  contribucion: number;
  margenContribucion: number | null;
  gastosFijos: number;
  fijosPorCategoria: Record<CategoriaFija, number>;
  utilidadOperativa: number;
  margenOperativo: number | null;
  /** Ventas necesarias para cubrir los gastos fijos con el margen de contribución actual. */
  puntoEquilibrio: { ventas: number | null; unidades: number | null; avance: number | null };
  costo: { cobertura: number | null; sinCostoPedidos: number; sinCostoMonto: number };
  ticketPromedio: number | null;
  /** Publicidad ÷ ventas entregadas. */
  costoPublicidadPorVenta: number | null;
  /** Ventas ÷ publicidad. */
  retornoPublicidad: number | null;
}

const fraccionDe = (parte: number, total: number) => (total !== 0 ? parte / total : null);

export function calcularResultados(e: EntradaResultados): Resultados {
  const ventas = e.ventas.monto;
  const igv = (e.igvPct || 0) / 100;
  const ventasSinIgv = igv > 0 ? ventas / (1 + igv) : ventas;
  const costoProducto = e.ventas.costo;
  const utilidadBruta = ventas - costoProducto - e.merma;
  const publicidadTotal = (e.publicidadConectada ?? 0) + e.gastos.publicidad;
  const gastosVariables = e.ventas.comisiones + e.envios + publicidadTotal;
  const contribucion = utilidadBruta - gastosVariables;
  const margenContribucion = fraccionDe(contribucion, ventas);
  const gastosFijos = e.gastos.fijos;
  const utilidadOperativa = contribucion - gastosFijos;

  let peVentas: number | null = null;
  let peUnidades: number | null = null;
  if (margenContribucion !== null && margenContribucion > 0) {
    peVentas = gastosFijos / margenContribucion;
    const contribucionPorUnidad = e.ventas.unidades > 0 ? contribucion / e.ventas.unidades : 0;
    peUnidades = contribucionPorUnidad > 0 ? Math.ceil(gastosFijos / contribucionPorUnidad) : null;
  }

  const fijosPorCategoria = Object.fromEntries(
    CATEGORIAS_FIJAS.map((c) => [c, e.gastos.porCategoria[c]]),
  ) as Record<CategoriaFija, number>;

  return {
    pedidos: e.ventas.pedidos,
    unidades: e.ventas.unidades,
    ventas,
    ventasSinIgv,
    igvIncluido: ventas - ventasSinIgv,
    costoProducto,
    merma: e.merma,
    utilidadBruta,
    margenBruto: fraccionDe(utilidadBruta, ventas),
    comisiones: e.ventas.comisiones,
    envios: e.envios,
    publicidad: { conectada: e.publicidadConectada, gastos: e.gastos.publicidad, total: publicidadTotal },
    gastosVariables,
    contribucion,
    margenContribucion,
    gastosFijos,
    fijosPorCategoria,
    utilidadOperativa,
    margenOperativo: fraccionDe(utilidadOperativa, ventas),
    puntoEquilibrio: {
      ventas: peVentas,
      unidades: peUnidades,
      avance: peVentas !== null && peVentas > 0 ? ventas / peVentas : null,
    },
    costo: {
      cobertura: e.ventas.coberturaCosto,
      sinCostoPedidos: e.ventas.sinCosto.pedidos,
      sinCostoMonto: e.ventas.sinCosto.monto,
    },
    ticketPromedio: e.ventas.ticketPromedio,
    costoPublicidadPorVenta: publicidadTotal > 0 && e.ventas.pedidos > 0 ? publicidadTotal / e.ventas.pedidos : null,
    retornoPublicidad: publicidadTotal > 0 ? ventas / publicidadTotal : null,
  };
}

/** Rango de un mes recortado a [desde, hasta]; null si no se tocan. */
export function rangoMesDentro(
  anio: number,
  mes: number,
  desde: DiaKey,
  hasta: DiaKey,
): { desde: DiaKey; hasta: DiaKey } | null {
  const inicio = maxDia(aDiaKey(anio, mes, 1), desde);
  const fin = minDia(aDiaKey(anio, mes, diasDelMes(anio, mes)), hasta);
  return diasEntre(inicio, fin) > 0 ? { desde: inicio, hasta: fin } : null;
}
