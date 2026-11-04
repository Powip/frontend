/**
 * ÚNICO lugar donde cambia la escala de los porcentajes de la ficha de canal (R27):
 * el backend RESPONDE fracción (0.125) y el PUT de ficha RECIBE 0..100 (12.5).
 * Lo mismo vale para las metas de unidad «porcentaje» (fracción 0..1 en ambos sentidos).
 */
const DECIMALES = 10_000;

function redondear(valor: number): number {
  return Math.round(valor * DECIMALES) / DECIMALES;
}

/** Lo que responde el backend (fracción) → lo que se escribe en el formulario (0..100). */
export function fraccionAPorcentaje(fraccion: number): number {
  return redondear(fraccion * 100);
}

/** Lo que escribe la persona (0..100) → lo que recibe el PUT de ficha (0..100). */
export function porcentajeParaEnvio(porcentaje: number): number {
  return redondear(porcentaje);
}

/** 0..100 escrito en un indicador de unidad porcentaje → fracción 0..1 que recibe `/config/metas`. */
export function porcentajeAFraccion(porcentaje: number): number {
  return redondear(porcentaje / 100);
}
