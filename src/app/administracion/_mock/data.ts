/**
 * Lo que queda realmente en uso de este archivo: tipos compartidos y
 * constantes de etiquetas (nombres de mes), nada de datos de ejemplo.
 *
 * Todo lo que antes vivía acá como "datos de ejemplo" (`*_MOCK`) se
 * eliminó al conectar cada pestaña a datos reales o a su solución puente en
 * `localStorage` (`_lib/pautaStorage.ts`, `metasStorage.ts`,
 * `cuentasStorage.ts`, `liquidacionesStorage.ts`, `capitalStorage.ts`) — ver
 * el historial de commits del módulo si hace falta recuperar algún ejemplo.
 *
 * Referencia: POWIP_Administracion_DocTecnica_Devs_v1.pdf
 */

// Reporte rápido (§16 doc)
export type ReportePeriodo = "hoy" | "semana" | "quincena" | "mes";

// Pauta por canal (§8 doc) — usado por _lib/pauta.ts y _lib/pautaStorage.ts
export type PautaLineaTipo = "prod" | "cat" | "gen";

export interface PautaLinea {
  tipo: PautaLineaTipo;
  ref: string; // sku | categoría | "General del canal"
  monto: number;
}

// Cuentas x Cobrar/Pagar (§11 doc) — usado por _lib/cuentasStorage.ts
export type TipoMovimiento = "ingreso" | "egreso";

export interface MovimientoHistorial {
  id: string;
  mes: string; // YYYY-MM
  tipo: TipoMovimiento;
  concepto: string;
  monto: number;
}

// Etiquetas de mes — usadas en Flujo de Caja, Cuentas y Resumen Anual
export const MESES_CORTOS = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];
export const MESES_LARGOS = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
