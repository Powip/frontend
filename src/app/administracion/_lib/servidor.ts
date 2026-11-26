/**
 * Adaptadores de la respuesta de `GET /administracion/resultados` (FEAT-34 Fase 2) a lo que usan las pantallas.
 *
 * El servidor ya aplica la definición única de venta (ENTREGADO y no LEAD), el costo (líneas, cabecera o «sin costo»
 * con costo parcial), el costo dudoso y el flete, y fecha cada venta el día de su ENTREGA en hora Lima (D1). Acá solo
 * se suma, se agrupa y se da forma: nada de pedidos crudos.
 */

import type {
  Agregado,
  AgregadoCanal,
  AgregadoDia,
  DiaCanal,
  ResultadosAdministracion,
} from "@/interfaces/IAdministracion";
import { type CanalEnDatos, claveCanal, grupoCanal, nombreCanal } from "./canales";
import type { DiaKey } from "./periodo";
import type { ResumenVentas } from "./ventas";

/** Montos a 2 decimales: las sumas de montos con centavos arrastran restos de coma flotante. */
const centavos = (valor: number) => Math.round((valor + Number.EPSILON) * 100) / 100;

export function agregadoVacio(): Agregado {
  return {
    pedidos: 0,
    monto: 0,
    unidades: 0,
    costo: 0,
    comisiones: 0,
    flete: { monto: 0, pedidos: 0 },
    sinCosto: { pedidos: 0, monto: 0 },
    costoDudoso: { pedidos: 0, monto: 0 },
  };
}

/** Respuesta sin ventas (mientras carga o sin rango válido): las pantallas no tienen que preguntar por null. */
export function resultadosVacios(desde: DiaKey, hasta: DiaKey): ResultadosAdministracion {
  return {
    desde,
    hasta,
    zonaHoraria: "America/Lima",
    fecha: "entrega",
    totales: agregadoVacio(),
    porDia: [],
    porCanal: [],
    porDiaCanal: [],
    porProducto: [],
    calidad: { entregasSinHistorial: 0 },
    enCurso: { pedidos: 0, adelantos: { pedidos: 0, monto: 0 } },
  };
}

export function sumarAgregados(lista: readonly Agregado[]): Agregado {
  const total = agregadoVacio();
  for (const a of lista) {
    total.pedidos += a.pedidos;
    total.monto += a.monto;
    total.unidades += a.unidades;
    total.costo += a.costo;
    total.comisiones += a.comisiones;
    total.flete.monto += a.flete.monto;
    total.flete.pedidos += a.flete.pedidos;
    total.sinCosto.pedidos += a.sinCosto.pedidos;
    total.sinCosto.monto += a.sinCosto.monto;
    total.costoDudoso.pedidos += a.costoDudoso.pedidos;
    total.costoDudoso.monto += a.costoDudoso.monto;
  }
  return {
    ...total,
    monto: centavos(total.monto),
    costo: centavos(total.costo),
    comisiones: centavos(total.comisiones),
    flete: { monto: centavos(total.flete.monto), pedidos: total.flete.pedidos },
    sinCosto: { pedidos: total.sinCosto.pedidos, monto: centavos(total.sinCosto.monto) },
    costoDudoso: { pedidos: total.costoDudoso.pedidos, monto: centavos(total.costoDudoso.monto) },
  };
}

/** El resumen de ventas de siempre (`_lib/ventas.ts`) a partir de un agregado del servidor. */
export function resumenDeAgregado(a: Agregado): ResumenVentas {
  return {
    pedidos: a.pedidos,
    monto: a.monto,
    unidades: a.unidades,
    costo: a.costo,
    comisiones: a.comisiones,
    sinCosto: { pedidos: a.sinCosto.pedidos, monto: a.sinCosto.monto },
    costoDudoso: { pedidos: a.costoDudoso.pedidos, monto: a.costoDudoso.monto },
    coberturaCosto: a.monto > 0 ? (a.monto - a.sinCosto.monto) / a.monto : null,
    ticketPromedio: a.pedidos > 0 ? a.monto / a.pedidos : null,
  };
}

// ---- Flete (D9) --------------------------------------------------------------------------------

/** Debajo de esta parte de entregas con flete conocido, se avisa que la utilidad sale sobreestimada. */
export const COBERTURA_FLETE_BAJA = 0.8;

export interface CoberturaFlete {
  /** Flete de las entregas que lo tienen. */
  monto: number;
  /** Entregas con flete conocido. */
  conFlete: number;
  /** Entregas del periodo. */
  entregas: number;
  /** conFlete ÷ entregas (0..1); null sin entregas. */
  cobertura: number | null;
}

export function coberturaFlete(a: Agregado): CoberturaFlete {
  return {
    monto: a.flete.monto,
    conFlete: a.flete.pedidos,
    entregas: a.pedidos,
    cobertura: a.pedidos > 0 ? a.flete.pedidos / a.pedidos : null,
  };
}

/**
 * Nota bajo «Envíos (flete por pedido)»: en cuántas entregas se conoce el flete. Con poca cobertura el resto no suma
 * envío y la utilidad sale más alta de lo real. null sin entregas.
 */
export function notaFlete(f: CoberturaFlete): { texto: string; baja: boolean } | null {
  if (f.entregas <= 0 || f.cobertura === null) return null;
  const n = (x: number) => x.toLocaleString("es-PE");
  const base = `Flete conocido en ${n(f.conFlete)} de ${n(f.entregas)} ${f.entregas === 1 ? "entrega" : "entregas"}`;
  const baja = f.cobertura < COBERTURA_FLETE_BAJA;
  return {
    texto: baja ? `${base}: el resto no suma envío, así que la utilidad sale sobreestimada` : base,
    baja,
  };
}

// ---- Canales -----------------------------------------------------------------------------------

/** Agregados por canal normalizado (`claveCanal`): las grafías de un mismo canal se suman. */
export function agregadosPorCanal(porCanal: readonly AgregadoCanal[]): Map<string, Agregado> {
  const grupos = new Map<string, Agregado[]>();
  for (const fila of porCanal) {
    const clave = claveCanal(fila.canal);
    grupos.set(clave, [...(grupos.get(clave) ?? []), fila]);
  }
  return new Map([...grupos.entries()].map(([clave, lista]) => [clave, sumarAgregados(lista)]));
}

/** Ventas por canal normalizado, como `ventasPorCanal` de `_lib/ventas.ts`. */
export function ventasPorCanalServidor(porCanal: readonly AgregadoCanal[]): Map<string, ResumenVentas> {
  return new Map([...agregadosPorCanal(porCanal).entries()].map(([clave, a]) => [clave, resumenDeAgregado(a)]));
}

/**
 * Canales que aparecen en las ventas, con el mismo formato que `canalesEnDatos`: grafías crudas de la más usada a la
 * menos usada y pedidos; del canal con más pedidos al que menos.
 */
export function canalesDelServidor(
  porCanal: readonly { canal: string | null; pedidos: number }[],
): CanalEnDatos[] {
  const mapa = new Map<string, { pedidos: number; grafias: Map<string, number> }>();
  for (const fila of porCanal) {
    const clave = claveCanal(fila.canal);
    const crudo = (fila.canal ?? "").trim();
    const actual = mapa.get(clave) ?? { pedidos: 0, grafias: new Map<string, number>() };
    actual.pedidos += fila.pedidos;
    if (crudo) actual.grafias.set(crudo, (actual.grafias.get(crudo) ?? 0) + fila.pedidos);
    mapa.set(clave, actual);
  }
  return [...mapa.entries()]
    .map(([clave, { pedidos, grafias }]) => ({
      clave,
      nombre: nombreCanal(clave),
      grupo: grupoCanal(clave),
      grafias: [...grafias.entries()].sort((a, b) => b[1] - a[1]).map(([g]) => g),
      pedidos,
    }))
    .sort((a, b) => b.pedidos - a.pedidos || a.nombre.localeCompare(b.nombre));
}

// ---- Series por día y por mes ------------------------------------------------------------------

export interface VentaDia {
  pedidos: number;
  monto: number;
  unidades: number;
}

/** Ventas de cada día (de entrega) del periodo. */
export function serieDiaria(porDia: readonly AgregadoDia[]): Map<DiaKey, VentaDia> {
  return new Map(porDia.map((d) => [d.dia, { pedidos: d.pedidos, monto: d.monto, unidades: d.unidades }]));
}

/** Ventas de cada día de un canal normalizado, sumando sus grafías (`porDiaCanal`). */
export function serieDiariaCanal(porDiaCanal: readonly DiaCanal[], clave: string): Map<DiaKey, VentaDia> {
  const serie = new Map<DiaKey, VentaDia>();
  for (const fila of porDiaCanal) {
    if (claveCanal(fila.canal) !== clave) continue;
    const actual = serie.get(fila.dia) ?? { pedidos: 0, monto: 0, unidades: 0 };
    serie.set(fila.dia, {
      pedidos: actual.pedidos + fila.pedidos,
      monto: centavos(actual.monto + fila.monto),
      unidades: actual.unidades + fila.unidades,
    });
  }
  return serie;
}

/** Agregados de cada mes (`YYYY-MM`) sumando los días de entrega. */
export function agregadosPorMes(porDia: readonly AgregadoDia[]): Map<string, Agregado> {
  const grupos = new Map<string, Agregado[]>();
  for (const dia of porDia) {
    const mes = dia.dia.slice(0, 7);
    grupos.set(mes, [...(grupos.get(mes) ?? []), dia]);
  }
  return new Map([...grupos.entries()].map(([mes, lista]) => [mes, sumarAgregados(lista)]));
}
