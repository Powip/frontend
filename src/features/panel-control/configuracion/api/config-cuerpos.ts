import type { CanalFicha } from "../../canales/models/canal-ficha.model";
import type { MetaIndicadorId, MetasPanel } from "../../shared/models/goal.model";
import type {
  ComisionRegla,
  ConfigFichaGuardar,
  ConfigMetasGuardar,
  CourierConfig,
  CourierConfigGuardar,
  GastoFijo,
  RolComision,
  TipoBloqueCanal,
} from "../models/configuracion.model";
import { fraccionAPorcentaje, porcentajeAFraccion, porcentajeParaEnvio } from "./config-escala";

/**
 * Cuerpos de los PUT de Configuración: cada uno arma SOLO lo que cambió respecto de lo que
 * devolvió el backend. Los formularios trabajan con textos; aquí se convierten a números y a la
 * escala que espera cada endpoint.
 */
export type Valores = Record<string, string>;

export function aNumero(texto: string): number {
  return Number(texto.trim().replace(",", "."));
}

function cambio(valores: Valores, iniciales: Valores, clave: string): string | null {
  const texto = valores[clave] ?? iniciales[clave] ?? "";
  if (texto === (iniciales[clave] ?? "")) return null;
  return texto;
}

// ---- Metas -------------------------------------------------------------------------------

type GrupoMensual = keyof MetasPanel["mensuales"];

function separar(clave: string): [string, string] {
  const corte = clave.indexOf(":");
  return [clave.slice(0, corte), clave.slice(corte + 1)];
}

/** Porcentajes de indicadores: se escriben 0..100 y viajan como fracción 0..1. */
export function cuerpoDeMetas(
  valores: Valores,
  iniciales: Valores,
  metas: MetasPanel,
): ConfigMetasGuardar {
  const cuerpo: ConfigMetasGuardar = {};
  for (const clave of Object.keys(valores)) {
    const texto = cambio(valores, iniciales, clave);
    if (texto === null || texto.trim() === "") continue;
    const [grupo, id] = separar(clave);
    const numero = aNumero(texto);
    if (grupo === "indicador") {
      const unidad = metas.indicadores[id as MetaIndicadorId].unidad;
      cuerpo.indicadores = {
        ...cuerpo.indicadores,
        [id]: unidad === "porcentaje" ? porcentajeAFraccion(numero) : numero,
      };
    } else {
      const g = grupo as GrupoMensual;
      cuerpo[g] = { ...cuerpo[g], [id]: numero };
    }
  }
  return cuerpo;
}

// ---- Comisiones --------------------------------------------------------------------------

export const claveRegla = (rol: RolComision, concepto: string) => `${rol}:${concepto}`;

export function valoresDeComisiones(reglas: ComisionRegla[]): Valores {
  const valores: Valores = {};
  for (const regla of reglas) valores[claveRegla(regla.rol, regla.concepto)] = String(regla.valor);
  return valores;
}

export function cuerpoDeComisiones(valores: Valores, iniciales: Valores): ComisionRegla[] {
  const reglas: ComisionRegla[] = [];
  for (const clave of Object.keys(valores)) {
    const texto = cambio(valores, iniciales, clave);
    if (texto === null || texto.trim() === "") continue;
    const [rol, concepto] = separar(clave);
    reglas.push({ rol: rol as RolComision, concepto, valor: aNumero(texto) });
  }
  return reglas;
}

// ---- Gastos fijos ------------------------------------------------------------------------

export function valoresDeGastos(gastos: GastoFijo[]): Valores {
  return Object.fromEntries(gastos.map((gasto) => [gasto.storeId, String(gasto.montoMensual)]));
}

export function cuerpoDeGastos(valores: Valores, iniciales: Valores): GastoFijo[] {
  const gastos: GastoFijo[] = [];
  for (const storeId of Object.keys(valores)) {
    const texto = cambio(valores, iniciales, storeId);
    if (texto === null || texto.trim() === "") continue;
    gastos.push({ storeId, montoMensual: aNumero(texto) });
  }
  return gastos;
}

// ---- Couriers ----------------------------------------------------------------------------

export const claveCourier = (key: string, campo: "nombre" | "plazo" | "tiempo") =>
  `${key}|${campo}`;

export function valoresDeCouriers(couriers: CourierConfig[]): Valores {
  const valores: Valores = {};
  for (const c of couriers) {
    valores[claveCourier(c.key, "nombre")] = c.nombre;
    valores[claveCourier(c.key, "plazo")] = c.plazoLiquidacionDias?.toString() ?? "";
    valores[claveCourier(c.key, "tiempo")] = c.tiempoNormalDias?.toString() ?? "";
  }
  return valores;
}

/** Vaciar un plazo cargado lo borra (`null`); lo no tocado se omite y el backend lo conserva. */
export function cuerpoDeCouriers(
  valores: Valores,
  iniciales: Valores,
  claves: string[],
): CourierConfigGuardar[] {
  const salida: CourierConfigGuardar[] = [];
  for (const key of claves) {
    const nuevo = !(claveCourier(key, "nombre") in iniciales);
    const item: CourierConfigGuardar = { key };
    const nombre = cambio(valores, iniciales, claveCourier(key, "nombre"));
    if (nombre !== null && nombre.trim() !== "") item.nombre = nombre.trim();
    const plazo = cambio(valores, iniciales, claveCourier(key, "plazo"));
    if (plazo !== null) {
      if (plazo.trim() !== "") item.plazoLiquidacionDias = aNumero(plazo);
      else if (!nuevo) item.plazoLiquidacionDias = null;
    }
    const tiempo = cambio(valores, iniciales, claveCourier(key, "tiempo"));
    if (tiempo !== null) {
      if (tiempo.trim() !== "") item.tiempoNormalDias = aNumero(tiempo);
      else if (!nuevo) item.tiempoNormalDias = null;
    }
    if (Object.keys(item).length > 1) salida.push(item);
  }
  return salida;
}

// ---- Ficha de canal ----------------------------------------------------------------------

export const CAMPOS_FICHA = ["familia", "tipo", "comision", "pasarela", "plazoDeposito"] as const;

export function valoresDeFicha(ficha: CanalFicha): Valores {
  return {
    familia: ficha.familia ?? "",
    tipo: ficha.tipo ?? "",
    // El backend RESPONDE fracción: el formulario muestra 0..100.
    comision: ficha.comisionPct == null ? "" : String(fraccionAPorcentaje(ficha.comisionPct)),
    pasarela: ficha.pasarelaPct == null ? "" : String(fraccionAPorcentaje(ficha.pasarelaPct)),
    plazoDeposito: ficha.plazoDepositoDias == null ? "" : String(ficha.plazoDepositoDias),
  };
}

/** El PUT de ficha recibe 0..100. Vaciar un campo cargado lo borra (`null`). */
export function cuerpoDeFicha(valores: Valores, iniciales: Valores): ConfigFichaGuardar {
  const cuerpo: ConfigFichaGuardar = {};
  const vacioANull = (texto: string) => texto.trim() === "";
  const familia = cambio(valores, iniciales, "familia");
  if (familia !== null) cuerpo.familia = vacioANull(familia) ? null : familia;
  const tipo = cambio(valores, iniciales, "tipo");
  if (tipo !== null) cuerpo.tipo = vacioANull(tipo) ? null : (tipo as TipoBloqueCanal);
  const comision = cambio(valores, iniciales, "comision");
  if (comision !== null) {
    cuerpo.pctComision = vacioANull(comision) ? null : porcentajeParaEnvio(aNumero(comision));
  }
  const pasarela = cambio(valores, iniciales, "pasarela");
  if (pasarela !== null) {
    cuerpo.pctPasarela = vacioANull(pasarela) ? null : porcentajeParaEnvio(aNumero(pasarela));
  }
  const plazo = cambio(valores, iniciales, "plazoDeposito");
  if (plazo !== null) cuerpo.plazoDepositoDias = vacioANull(plazo) ? null : aNumero(plazo);
  return cuerpo;
}
