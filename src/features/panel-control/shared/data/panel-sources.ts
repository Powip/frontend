import { opcionesAsesoresRealSource } from "../../asesores/sources/opciones-asesores.source";
import { callCenterRealSource } from "../../call-center/sources/call-center.source";
import { canalesComparativoRealSource } from "../../canales/sources/canales-comparativo.source";
import { canalesDetalleRealSource } from "../../canales/sources/canales-detalle.source";
import { canalesFichasRealSource } from "../../canales/sources/canales-fichas.source";
import { clientesZonasRealSource } from "../../clientes-zonas/sources/clientes-zonas.source";
import { configMetasDemoSource } from "../../configuracion/sources/config-metas.demo";
import {
  configCuadresDemoSource,
  configEstadosDemoSource,
} from "../../configuracion/sources/configuracion.demo";
import { detalleDemoSource } from "../../detalle/sources/detalle.demo";
import {
  detalleCallCenterRealSource,
  detalleCanalesRealSource,
  detalleClientesRealSource,
  detalleEquipoRealSource,
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
import {
  compartirReporteDemoSource,
  exportacionLibroDemoSource,
} from "../../exportacion/sources/exportacion.demo";
import {
  finanzasCajaDemoSource,
  finanzasCobranzaDemoSource,
  finanzasResultadoDemoSource,
} from "../../finanzas/sources/finanzas.demo";
import { misVentasRealSource } from "../../mis-ventas/sources/mis-ventas.source";
import {
  operacionesColaRealSource,
  operacionesCouriersRealSource,
  operacionesInventarioRealSource,
} from "../../operaciones/sources/operaciones.source";
import { productosRealSource } from "../../productos/sources/productos.source";
import { publicidadDemoSource } from "../../publicidad/sources/publicidad.demo";
import { resumenRealSource } from "../../resumen/sources/resumen.source";
import type { PanelContractId } from "../models/panel-contract.model";
import { conAutorizacion } from "./panel-autorizacion";
import type { PanelSource, PanelSourceRegistry } from "./panel-source";

function autorizarRegistro(registro: PanelSourceRegistry): PanelSourceRegistry {
  const autorizado: PanelSourceRegistry = {};
  for (const [id, entrada] of Object.entries(registro) as [
    PanelContractId,
    PanelSource<PanelContractId> | readonly PanelSource<PanelContractId>[],
  ][]) {
    (autorizado as Record<PanelContractId, unknown>)[id] = Array.isArray(entrada)
      ? entrada.map((fuente) => conAutorizacion(fuente))
      : conAutorizacion(entrada as PanelSource<PanelContractId>);
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
    detalleDemoSource,
  ],
  "config-metas": configMetasDemoSource,
  "canales-comparativo": canalesComparativoRealSource,
  "canales-detalle": canalesDetalleRealSource,
  productos: productosRealSource,
  publicidad: publicidadDemoSource,
  "clientes-zonas": clientesZonasRealSource,
  callcenter: callCenterRealSource,
  "operaciones-cola": operacionesColaRealSource,
  "operaciones-couriers": operacionesCouriersRealSource,
  "operaciones-inventario": operacionesInventarioRealSource,
  "finanzas-resultado": finanzasResultadoDemoSource,
  "finanzas-caja": finanzasCajaDemoSource,
  "finanzas-cobranza": finanzasCobranzaDemoSource,
  "equipo-vendedoras": equipoVendedorasRealSource,
  "equipo-confirmadoras": equipoConfirmadorasRealSource,
  "mis-ventas": misVentasRealSource,
  "config-estados": configEstadosDemoSource,
  "config-cuadres": configCuadresDemoSource,
  "exportacion-libro": exportacionLibroDemoSource,
  "compartir-reporte": compartirReporteDemoSource,
});
