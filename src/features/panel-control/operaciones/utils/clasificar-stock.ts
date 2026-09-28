import type { EstadoStock } from "../models/inventario.model";

export const UMBRAL_CRITICO_DIAS = 7;
export const UMBRAL_BAJO_DIAS = 15;
export const UMBRAL_SOBRESTOCK_DIAS = 90;

export interface CoberturaStock {
  disponible: number;
  ventaDiaria: number;
  coberturaDias: number | null;
  estado: EstadoStock;
}

export function clasificarStock(
  stock: number,
  reservado: number,
  unidades30Dias: number,
): CoberturaStock {
  const disponible = stock - reservado;
  const ventaDiaria = unidades30Dias / 30;
  const coberturaDias = ventaDiaria > 0 ? Math.max(0, disponible) / ventaDiaria : null;
  let estado: EstadoStock;
  if (stock < 0) estado = "error_datos";
  else if (disponible <= 0) estado = "agotado";
  else if (coberturaDias === null) estado = "ok";
  else if (coberturaDias < UMBRAL_CRITICO_DIAS) estado = "critico";
  else if (coberturaDias < UMBRAL_BAJO_DIAS) estado = "bajo";
  else if (coberturaDias > UMBRAL_SOBRESTOCK_DIAS) estado = "sobrestock";
  else estado = "ok";
  return { disponible, ventaDiaria, coberturaDias, estado };
}
