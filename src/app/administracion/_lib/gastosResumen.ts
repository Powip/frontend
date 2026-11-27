/**
 * Agrupados de los bloques «Compra de mercadería por prenda» e «Implementos» del Resumen. Suman la parte que le toca
 * al periodo (`prorratearGastos`), así cuadran con el resto de Administración. No cambian el estado de resultados.
 */

import type { CategoriaGasto } from "@/interfaces/IAdmin";
import type { GastoProrrateado } from "./resultados";

export interface FilaGastoAgrupado {
  key: string;
  nombre: string;
  registros: number;
  total: number;
}

export interface GastoAgrupado {
  total: number;
  filas: FilaGastoAgrupado[];
}

export const SIN_PRENDA = "sin-prenda";
export const SIN_DESCRIPCION = "sin-descripcion";

function agrupar(
  filas: GastoProrrateado[],
  categoria: CategoriaGasto,
  clave: (g: GastoProrrateado["gasto"]) => { key: string; nombre: string },
): GastoAgrupado {
  const porClave = new Map<string, FilaGastoAgrupado>();
  let total = 0;
  for (const { gasto, montoPeriodo } of filas) {
    if (gasto.categoria !== categoria) continue;
    const { key, nombre } = clave(gasto);
    const fila = porClave.get(key) ?? { key, nombre, registros: 0, total: 0 };
    fila.registros += 1;
    fila.total += montoPeriodo;
    porClave.set(key, fila);
    total += montoPeriodo;
  }
  return { total, filas: [...porClave.values()].sort((a, b) => b.total - a.total) };
}

/** Compra de mercadería (INVERSION) por prenda; los registros sin prenda van juntos. */
export function agruparCompraPorPrenda(filas: GastoProrrateado[]): GastoAgrupado {
  return agrupar(filas, "INVERSION", (g) => ({
    key: g.productId ?? SIN_PRENDA,
    nombre: g.productName || "Sin prenda",
  }));
}

/** Implementos por descripción, sin distinguir mayúsculas. */
export function agruparImplementos(filas: GastoProrrateado[]): GastoAgrupado {
  return agrupar(filas, "IMPLEMENTOS", (g) => {
    const descripcion = (g.descripcion ?? "").trim();
    return descripcion
      ? { key: descripcion.toLowerCase(), nombre: descripcion }
      : { key: SIN_DESCRIPCION, nombre: "Sin descripción" };
  });
}
