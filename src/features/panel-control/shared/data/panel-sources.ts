import { opcionesAsesoresRealSource } from "../../asesores/sources/opciones-asesores.source";
import { callCenterRealSource } from "../../call-center/sources/call-center.source";
import { canalesComparativoRealSource } from "../../canales/sources/canales-comparativo.source";
import { canalesDetalleRealSource } from "../../canales/sources/canales-detalle.source";
import { canalesFichasRealSource } from "../../canales/sources/canales-fichas.source";
import { clientesZonasRealSource } from "../../clientes-zonas/sources/clientes-zonas.source";
import { configCuadresRealSource } from "../../configuracion/sources/config-cuadres.source";
import { configEstadosRealSource } from "../../configuracion/sources/config-estados.source";
import { configMetasRealSource } from "../../configuracion/sources/config-metas.source";
import {
  configComisionesRealSource,
  configCouriersRealSource,
  configGastosFijosRealSource,
} from "../../configuracion/sources/config-reglas.source";
import { detalleDemoSource } from "../../detalle/sources/detalle.demo";
import {
  detalleCallCenterRealSource,
  detalleCanalesRealSource,
  detalleClientesRealSource,
  detalleEquipoRealSource,
  detalleFinanzasRealSource,
  detalleMisVentasRealSource,
  detalleOperacionesRealSource,
  detalleProductosRealSource,
  detalleRealSource,
} from "../../detalle/sources/detalle.source";
import {
  equipoConfirmadorasRealSource,
  equipoVendedorasRealSource,
} from "../../equipo/sources/equipo.source";
import { estadoPeriodoRealSource } from "../../estado-periodo/sources/estado-periodo.source";
import { compartirReporteRealSource } from "../../exportacion/sources/compartir.source";
import { exportacionLibroRealSource } from "../../exportacion/sources/exportacion.source";
import {
  finanzasCajaRealSource,
  finanzasCobranzaRealSource,
  finanzasResultadoRealSource,
} from "../../finanzas/sources/finanzas.source";
import { misVentasRealSource } from "../../mis-ventas/sources/mis-ventas.source";
import {
  operacionesColaRealSource,
  operacionesCouriersRealSource,
  operacionesInventarioRealSource,
} from "../../operaciones/sources/operaciones.source";
import { productosRealSource } from "../../productos/sources/productos.source";
import { resumenRealSource } from "../../resumen/sources/resumen.source";
import { metasOcultas } from "../config/panel-entrega.config";
import type { PanelContractId } from "../models/panel-contract.model";
import { conAutorizacion } from "./panel-autorizacion";
import type { PanelSource, PanelSourceRegistry } from "./panel-source";

/**
 * Mientras Metas esté oculta, ningún contrato entrega metas (ni las del backend): las vistas
 * reciben `metas: null` y muestran su estado «sin meta configurada».
 */
export function sinMetasOcultas<K extends PanelContractId>(source: PanelSource<K>): PanelSource<K> {
  return {
    ...source,
    fetch: async (query, context) => {
      const resultado = await source.fetch(query, context);
      if (
        metasOcultas() &&
        resultado !== null &&
        typeof resultado === "object" &&
        "metas" in resultado &&
        resultado.metas !== null
      ) {
        return { ...resultado, metas: null } as typeof resultado;
      }
      return resultado;
    },
  };
}

export function autorizarRegistro(registro: PanelSourceRegistry): PanelSourceRegistry {
  const autorizado: PanelSourceRegistry = {};
  for (const [id, entrada] of Object.entries(registro) as [
    PanelContractId,
    PanelSource<PanelContractId> | readonly PanelSource<PanelContractId>[],
  ][]) {
    (autorizado as Record<PanelContractId, unknown>)[id] = Array.isArray(entrada)
      ? entrada.map((fuente) => sinMetasOcultas(conAutorizacion(fuente)))
      : sinMetasOcultas(conAutorizacion(entrada as PanelSource<PanelContractId>));
  }
  return autorizado;
}

export const DEFAULT_PANEL_SOURCES: PanelSourceRegistry = autorizarRegistro({
  "canales-fichas": canalesFichasRealSource,
  "opciones-asesores": opcionesAsesoresRealSource,
  "estado-periodo": estadoPeriodoRealSource,
  resumen: resumenRealSource,
  // Real en el Resumen (ya conectado); demo en las pestañas que todavía no tienen backend.
  detalle: [
    detalleRealSource,
    detalleCanalesRealSource,
    detalleProductosRealSource,
    detalleClientesRealSource,
    detalleCallCenterRealSource,
    detalleEquipoRealSource,
    detalleMisVentasRealSource,
    detalleOperacionesRealSource,
    detalleFinanzasRealSource,
    detalleDemoSource,
  ],
  "config-metas": configMetasRealSource,
  "config-comisiones": configComisionesRealSource,
  "config-gastos-fijos": configGastosFijosRealSource,
  "config-couriers": configCouriersRealSource,
  "canales-comparativo": canalesComparativoRealSource,
  "canales-detalle": canalesDetalleRealSource,
  productos: productosRealSource,
  "clientes-zonas": clientesZonasRealSource,
  callcenter: callCenterRealSource,
  "operaciones-cola": operacionesColaRealSource,
  "operaciones-couriers": operacionesCouriersRealSource,
  "operaciones-inventario": operacionesInventarioRealSource,
  "finanzas-resultado": finanzasResultadoRealSource,
  "finanzas-caja": finanzasCajaRealSource,
  "finanzas-cobranza": finanzasCobranzaRealSource,
  "equipo-vendedoras": equipoVendedorasRealSource,
  "equipo-confirmadoras": equipoConfirmadorasRealSource,
  "mis-ventas": misVentasRealSource,
  "config-estados": configEstadosRealSource,
  "config-cuadres": configCuadresRealSource,
  "exportacion-libro": exportacionLibroRealSource,
  "compartir-reporte": compartirReporteRealSource,
});
