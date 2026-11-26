/**
 * Fechas de Administración como claves de día `YYYY-MM-DD` (hora Lima).
 *
 * Nunca se hace `new Date("YYYY-MM-DD")`: eso es medianoche UTC y en Perú (UTC-5) cae el día anterior.
 * Las claves se parten a mano y los instantes del backend (`created_at`, ISO en UTC) se pasan a día de Lima
 * con `diaLima`.
 */

export type DiaKey = string;

const ZONA = "America/Lima";
const MESES_CORTOS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "set", "oct", "nov", "dic"];
const MESES_LARGOS = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "setiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

export { MESES_CORTOS, MESES_LARGOS };

const pad = (n: number) => String(n).padStart(2, "0");

export function esDiaKey(valor: unknown): valor is DiaKey {
  return typeof valor === "string" && /^\d{4}-\d{2}-\d{2}$/.test(valor);
}

export function partes(dia: DiaKey): [number, number, number] {
  const [a, m, d] = dia.split("-").map(Number);
  return [a, m, d];
}

export function aDiaKey(anio: number, mes: number, dia: number): DiaKey {
  return `${anio}-${pad(mes)}-${pad(dia)}`;
}

export function diasDelMes(anio: number, mes: number): number {
  return new Date(Date.UTC(anio, mes, 0)).getUTCDate();
}

function aUtc(dia: DiaKey): number {
  const [a, m, d] = partes(dia);
  return Date.UTC(a, m - 1, d);
}

function desdeUtc(ms: number): DiaKey {
  const f = new Date(ms);
  return aDiaKey(f.getUTCFullYear(), f.getUTCMonth() + 1, f.getUTCDate());
}

/** Días entre dos claves, contando ambas puntas. 0 si `hasta` es anterior a `desde`. */
export function diasEntre(desde: DiaKey, hasta: DiaKey): number {
  const n = Math.round((aUtc(hasta) - aUtc(desde)) / 86_400_000) + 1;
  return Math.max(0, n);
}

export function sumarDias(dia: DiaKey, n: number): DiaKey {
  return desdeUtc(aUtc(dia) + n * 86_400_000);
}

export function minDia(a: DiaKey, b: DiaKey): DiaKey {
  return a <= b ? a : b;
}

export function maxDia(a: DiaKey, b: DiaKey): DiaKey {
  return a >= b ? a : b;
}

const formatoLima = new Intl.DateTimeFormat("en-CA", {
  timeZone: ZONA,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Día de Lima de un instante. Un texto sin zona se toma como UTC (así guarda ms-ventas). */
export function diaLima(instante: string | Date | null | undefined): DiaKey | null {
  if (!instante) return null;
  let fecha: Date;
  if (instante instanceof Date) {
    fecha = instante;
  } else {
    const texto = /[zZ]|[+-]\d{2}:?\d{2}$/.test(instante) ? instante : `${instante.replace(" ", "T")}Z`;
    fecha = new Date(texto);
  }
  if (Number.isNaN(fecha.getTime())) return null;
  return formatoLima.format(fecha);
}

export function hoyLima(ahora: Date = new Date()): DiaKey {
  return formatoLima.format(ahora);
}

export function inicioDeMes(dia: DiaKey): DiaKey {
  const [a, m] = partes(dia);
  return aDiaKey(a, m, 1);
}

export function finDeMes(dia: DiaKey): DiaKey {
  const [a, m] = partes(dia);
  return aDiaKey(a, m, diasDelMes(a, m));
}

/** Corre una clave `n` meses (negativo = hacia atrás) y recorta el día al largo del mes destino. */
export function sumarMeses(dia: DiaKey, n: number): DiaKey {
  const [a, m, d] = partes(dia);
  const total = a * 12 + (m - 1) + n;
  const anio = Math.floor(total / 12);
  const mes = (total % 12) + 1;
  return aDiaKey(anio, mes, Math.min(d, diasDelMes(anio, mes)));
}

export interface TramoMes {
  anio: number;
  mes: number;
  /** Días del periodo que caen en este mes. */
  dias: number;
  diasMes: number;
}

/** Meses que toca el periodo y cuántos días de cada uno. */
export function mesesDelPeriodo(desde: DiaKey, hasta: DiaKey): TramoMes[] {
  if (hasta < desde) return [];
  const tramos: TramoMes[] = [];
  let cursor = desde;
  while (cursor <= hasta) {
    const [anio, mes] = partes(cursor);
    const fin = minDia(finDeMes(cursor), hasta);
    tramos.push({ anio, mes, dias: diasEntre(cursor, fin), diasMes: diasDelMes(anio, mes) });
    cursor = sumarDias(finDeMes(cursor), 1);
  }
  return tramos;
}

const esMesesCompletos = (desde: DiaKey, hasta: DiaKey) =>
  desde === inicioDeMes(desde) && hasta === finDeMes(hasta);

/**
 * Periodo con el que se compara:
 * - meses completos (1 al último día): los mismos meses justo antes;
 * - un tramo de hasta 31 días: el mismo tramo un mes antes (1–25 nov → 1–25 oct);
 * - otro rango: los mismos días justo antes.
 */
export function periodoAnterior(desde: DiaKey, hasta: DiaKey): { desde: DiaKey; hasta: DiaKey } {
  if (esMesesCompletos(desde, hasta)) {
    const [a1, m1] = partes(desde);
    const [a2, m2] = partes(hasta);
    const meses = (a2 * 12 + m2) - (a1 * 12 + m1) + 1;
    const nuevoDesde = sumarMeses(desde, -meses);
    return { desde: nuevoDesde, hasta: finDeMes(sumarMeses(hasta, -meses)) };
  }
  const largo = diasEntre(desde, hasta);
  if (largo <= 31) {
    return { desde: sumarMeses(desde, -1), hasta: sumarMeses(hasta, -1) };
  }
  return { desde: sumarDias(desde, -largo), hasta: sumarDias(desde, -1) };
}

/** «1–25 nov 2026», «28 oct – 3 nov 2026», «nov 2026», «2026». */
export function etiquetaPeriodo(desde: DiaKey, hasta: DiaKey): string {
  const [a1, m1, d1] = partes(desde);
  const [a2, m2, d2] = partes(hasta);
  if (a1 === a2 && desde === aDiaKey(a1, 1, 1) && hasta === aDiaKey(a2, 12, 31)) return String(a1);
  if (a1 === a2 && m1 === m2) {
    if (esMesesCompletos(desde, hasta)) return `${MESES_LARGOS[m1 - 1]} ${a1}`;
    if (d1 === d2) return `${d1} ${MESES_CORTOS[m1 - 1]} ${a1}`;
    return `${d1}–${d2} ${MESES_CORTOS[m1 - 1]} ${a1}`;
  }
  if (a1 === a2) return `${d1} ${MESES_CORTOS[m1 - 1]} – ${d2} ${MESES_CORTOS[m2 - 1]} ${a2}`;
  return `${d1} ${MESES_CORTOS[m1 - 1]} ${a1} – ${d2} ${MESES_CORTOS[m2 - 1]} ${a2}`;
}

export function etiquetaMes(anio: number, mes: number, largo = false): string {
  return largo ? `${MESES_LARGOS[mes - 1]} ${anio}` : `${MESES_CORTOS[mes - 1]} ${String(anio).slice(2)}`;
}

export type PresetPeriodo =
  | "hoy"
  | "ultimos_7"
  | "ultimos_15"
  | "mes_actual"
  | "mes_anterior"
  | "anio_actual"
  | "personalizado";

export const PRESETS_PERIODO: { id: PresetPeriodo; label: string }[] = [
  { id: "hoy", label: "Hoy" },
  { id: "ultimos_7", label: "Últimos 7 días" },
  { id: "ultimos_15", label: "Últimos 15 días" },
  { id: "mes_actual", label: "Este mes" },
  { id: "mes_anterior", label: "Mes anterior" },
  { id: "anio_actual", label: "Este año" },
  { id: "personalizado", label: "Personalizado" },
];

/** Rango de un atajo. Ninguno pasa de hoy: los días futuros no tienen ventas y sí restarían gastos. */
export function rangoDePreset(
  preset: Exclude<PresetPeriodo, "personalizado">,
  hoy: DiaKey,
): { desde: DiaKey; hasta: DiaKey } {
  switch (preset) {
    case "hoy":
      return { desde: hoy, hasta: hoy };
    case "ultimos_7":
      return { desde: sumarDias(hoy, -6), hasta: hoy };
    case "ultimos_15":
      return { desde: sumarDias(hoy, -14), hasta: hoy };
    case "mes_actual":
      return { desde: inicioDeMes(hoy), hasta: hoy };
    case "mes_anterior": {
      const previo = sumarMeses(inicioDeMes(hoy), -1);
      return { desde: previo, hasta: finDeMes(previo) };
    }
    case "anio_actual":
      return { desde: aDiaKey(partes(hoy)[0], 1, 1), hasta: hoy };
  }
}

/** Atajo que corresponde a un rango, o `personalizado`. */
export function presetDeRango(desde: DiaKey, hasta: DiaKey, hoy: DiaKey): PresetPeriodo {
  for (const { id } of PRESETS_PERIODO) {
    if (id === "personalizado") continue;
    const r = rangoDePreset(id, hoy);
    if (r.desde === desde && r.hasta === hasta) return id;
  }
  return "personalizado";
}

/**
 * Los cocientes de publicidad solo salen con días cerrados: si el periodo llega a hoy (o más allá) se corta en
 * ayer. Devuelve null si no queda ningún día cerrado (por ejemplo, «Hoy»).
 */
export function hastaAyer(
  desde: DiaKey,
  hasta: DiaKey,
  hoy: DiaKey,
): { desde: DiaKey; hasta: DiaKey } | null {
  const ayer = sumarDias(hoy, -1);
  const fin = minDia(hasta, ayer);
  return fin < desde ? null : { desde, hasta: fin };
}
