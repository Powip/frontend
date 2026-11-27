/**
 * Lo que Administración guardaba en el localStorage del navegador antes de la Fase 3 de FEAT-34 (metas, objetivos por
 * canal, capital y cuentas), armado para subirlo una vez a ms-ventas (`POST /administracion/importar-local`).
 *
 * El servidor importa cada tipo (y cada año de metas) solo si no tiene nada de eso. Después de subir, cada clave se
 * mueve a `powip:admin:respaldo:*`: no se pierde nada y la importación deja de ofrecerse. El registro manual de
 * publicidad (`powip:admin:pauta:*`) no se sube: se retiró (D2, P6 de la Fase 3) y su clave queda como estaba.
 */

import type { CapitalNuevo, CuentaNueva, ImportacionLocal, TipoCapitalServidor } from "@/interfaces/IAdministracion";
import { TIPO_CAPITAL_SERVIDOR } from "./capitalStorage";
import { hayMetas, normalizarMetas } from "./metasStorage";
import { claveObjetivo, normalizarObjetivo } from "./objetivoStorage";
import { diasDelMes, esDiaKey, partes } from "./periodo";

const PREFIJO = "powip:admin:";
const RESPALDO = "powip:admin:respaldo:";
/** Límites del servidor (`administracion-datos.dto.ts`): un solo dato fuera de ellos rechaza toda la importación. */
const MONTO_MAXIMO = 999_999_999_999;
const MAX_FILAS = 500;
const CANAL_VALIDO = /^(todos|[A-Z0-9_]{1,60})$/;

const TIPO_CAPITAL: Record<string, TipoCapitalServidor> = TIPO_CAPITAL_SERVIDOR;

export interface ImportacionArmada {
  datos: Required<ImportacionLocal>;
  /** Claves del navegador que se leyeron (las que se respaldan después de subir). */
  claves: string[];
  hayDatos: boolean;
}

const positivo = (valor: unknown): number | null => {
  if (valor === null || valor === undefined || valor === "") return null;
  const n = Number(valor);
  return Number.isFinite(n) && n > 0 ? n : null;
};
const centavos = (n: number) => Math.round(n * 100) / 100;
/** Monto válido para el servidor: > 0, con 2 decimales y no más del máximo; si no, null. */
const monto = (valor: unknown): number | null => {
  const n = positivo(valor);
  if (n === null) return null;
  const redondeado = centavos(n);
  return redondeado > 0 && redondeado <= MONTO_MAXIMO ? redondeado : null;
};
/** Día `YYYY-MM-DD` que existe en el calendario (el servidor rechaza un 30 de febrero). */
const diaReal = (valor: unknown): string | null => {
  if (!esDiaKey(valor)) return null;
  const [a, m, d] = partes(valor);
  return m >= 1 && m <= 12 && d >= 1 && d <= diasDelMes(a, m) ? valor : null;
};
const texto = (valor: unknown, max: number) => (typeof valor === "string" ? valor.trim().slice(0, max) : "");

function leer(storage: Storage, clave: string): unknown {
  try {
    const raw = storage.getItem(clave);
    return raw == null ? null : (JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
}

function clavesConPrefijo(storage: Storage, prefijo: string): string[] {
  const claves: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const clave = storage.key(i);
    if (clave?.startsWith(prefijo)) claves.push(clave);
  }
  return claves.sort();
}

function capitalDe(storage: Storage, companyId: string, claves: string[]): CapitalNuevo[] {
  const clave = `${PREFIJO}capital:${companyId}`;
  const crudo = leer(storage, clave);
  if (storage.getItem(clave) !== null) claves.push(clave);
  const lista = Array.isArray(crudo) ? (crudo as Array<Record<string, unknown>>) : [];
  const salida: CapitalNuevo[] = [];
  for (const e of lista) {
    const tipo = TIPO_CAPITAL[String(e?.tipo)];
    const importe = monto(e?.monto);
    if (!tipo || importe === null) continue;
    const base = { tipo, descripcion: texto(e.descripcion, 200), monto: importe, tienda: texto(e.tienda, 120) || null };
    if (tipo !== "prestamo") {
      salida.push({ ...base, tienda: base.tienda ?? null });
      continue;
    }
    const claveCuotas = `${PREFIJO}capital-cuotas-pagadas:${companyId}:${String(e.id)}`;
    if (storage.getItem(claveCuotas) !== null) claves.push(claveCuotas);
    const plazo = positivo(e.plazoCuotas);
    const plazoCuotas = plazo !== null ? Math.min(600, Math.round(plazo)) : null;
    const pagadas = Math.max(0, Math.round(Number(leer(storage, claveCuotas)) || 0));
    const tea = e.tasaAnualPct === null || e.tasaAnualPct === undefined || e.tasaAnualPct === "" ? NaN : Number(e.tasaAnualPct);
    salida.push({
      ...base,
      teaPct: Number.isFinite(tea) && tea >= 0 && tea <= 1000 ? Math.round(tea * 10_000) / 10_000 : null,
      plazoCuotas,
      cuotaMensual: monto(e.cuotaMensual),
      fechaInicio: diaReal(e.fechaInicio),
      cuotasPagadas: plazoCuotas !== null ? Math.min(pagadas, plazoCuotas) : Math.min(pagadas, 600),
    });
  }
  return salida.slice(0, MAX_FILAS);
}

function cuentasDe(storage: Storage, companyId: string, claves: string[]): CuentaNueva[] {
  const salida: CuentaNueva[] = [];
  for (const lado of ["cobrar", "pagar"] as const) {
    const clave = `${PREFIJO}cuentas-${lado}:${companyId}`;
    if (storage.getItem(clave) === null) continue;
    claves.push(clave);
    const lista = leer(storage, clave);
    for (const c of Array.isArray(lista) ? (lista as Array<Record<string, unknown>>) : []) {
      const importe = monto(c?.monto);
      if (importe === null) continue;
      const vence = texto(c.vencimiento, 200);
      const descripcion = [texto(c.descripcion, 300), vence ? `Vence: ${vence}` : ""].filter(Boolean).join(" · ");
      salida.push({
        lado,
        concepto: texto(c.concepto, 120) || "Sin concepto",
        descripcion: descripcion.slice(0, 500),
        monto: importe,
        vence: null,
        saldadaEn: null,
      });
    }
  }
  const claveHistorial = `${PREFIJO}cuentas-historial:${companyId}`;
  if (storage.getItem(claveHistorial) !== null) {
    claves.push(claveHistorial);
    const lista = leer(storage, claveHistorial);
    for (const h of Array.isArray(lista) ? (lista as Array<Record<string, unknown>>) : []) {
      const importe = monto(h?.monto);
      const dia = diaReal(`${String(h?.mes)}-01`);
      if (importe === null || dia === null) continue;
      salida.push({
        lado: h.tipo === "ingreso" ? "cobrar" : "pagar",
        concepto: texto(h.concepto, 120) || "Sin concepto",
        descripcion: "",
        monto: importe,
        vence: null,
        saldadaEn: dia,
      });
    }
  }
  return salida.slice(0, MAX_FILAS);
}

/** Lee lo que quedó en este navegador para la empresa y lo arma como lo espera el servidor. Nunca lanza. */
export function armarImportacion(storage: Storage, companyId: string): ImportacionArmada {
  const claves: string[] = [];
  const datos: Required<ImportacionLocal> = { metas: [], objetivos: [], capital: [], cuentas: [] };
  if (!companyId) return { datos, claves, hayDatos: false };

  for (const clave of clavesConPrefijo(storage, `${PREFIJO}metas:${companyId}:`)) {
    const anio = Number(clave.slice(`${PREFIJO}metas:${companyId}:`.length));
    if (!Number.isInteger(anio) || anio < 2000 || anio > 2100) continue;
    claves.push(clave);
    const crudas = normalizarMetas(leer(storage, clave) as never);
    const margen = crudas.margenObjetivoPct !== null && crudas.margenObjetivoPct <= 100 ? centavos(crudas.margenObjetivoPct) : null;
    const metas = {
      ventasAnual: monto(crudas.ventasAnual),
      profitAnual: monto(crudas.profitAnual),
      margenObjetivoPct: margen !== null && margen > 0 ? margen : null,
    };
    if (hayMetas(metas)) datos.metas.push({ anio, ...metas });
  }
  datos.metas.sort((a, b) => b.anio - a.anio);

  // Un canal puede tener dos claves (una vieja sin normalizar): gana la ya normalizada.
  const objetivos = new Map<string, { ventasDia: number; normalizada: boolean }>();
  for (const clave of clavesConPrefijo(storage, `${PREFIJO}objetivo-canal:${companyId}:`)) {
    claves.push(clave);
    const crudo = clave.slice(`${PREFIJO}objetivo-canal:${companyId}:`.length);
    const canal = crudo ? claveObjetivo(crudo) : "";
    const objetivo = normalizarObjetivo(leer(storage, clave));
    const ventasDia = monto(objetivo.ventasDia ?? (objetivo.metaVentasMes !== null ? objetivo.metaVentasMes / 30 : null));
    if (!CANAL_VALIDO.test(canal) || ventasDia === null) continue;
    const normalizada = crudo === canal;
    const previo = objetivos.get(canal);
    if (!previo || (normalizada && !previo.normalizada)) objetivos.set(canal, { ventasDia, normalizada });
  }
  datos.objetivos = [...objetivos.entries()].map(([canal, o]) => ({ canal, ventasDia: o.ventasDia })).slice(0, MAX_FILAS);

  try {
    datos.capital = capitalDe(storage, companyId, claves);
    datos.cuentas = cuentasDe(storage, companyId, claves);
  } catch {
    // Un dato raro no frena lo demás: se sube lo que se pudo leer.
  }

  const hayDatos =
    datos.metas.length + datos.objetivos.length + datos.capital.length + datos.cuentas.length > 0;
  return { datos, claves, hayDatos };
}

/** Mueve cada clave a `powip:admin:respaldo:*` (sin perder nada) para que la importación no se ofrezca de nuevo. */
export function guardarRespaldoLocal(storage: Storage, claves: string[]): void {
  for (const clave of claves) {
    try {
      const valor = storage.getItem(clave);
      if (valor === null) continue;
      storage.setItem(`${RESPALDO}${clave.slice(PREFIJO.length)}`, valor);
      storage.removeItem(clave);
    } catch {
      // Navegador lleno o bloqueado: queda como estaba (se puede volver a intentar).
    }
  }
}
