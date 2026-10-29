import { opcionesAsesoresRealSource } from "../../asesores/sources/opciones-asesores.source";
import { callCenterDemoSource } from "../../call-center/sources/call-center.demo";
import {
  canalesComparativoDemoSource,
  canalesDetalleDemoSource,
} from "../../canales/sources/canales.demo";
import { canalesFichasRealSource } from "../../canales/sources/canales-fichas.source";
import { clientesZonasDemoSource } from "../../clientes-zonas/sources/clientes-zonas.demo";
import { configMetasDemoSource } from "../../configuracion/sources/config-metas.demo";
import {
  configCuadresDemoSource,
  configEstadosDemoSource,
} from "../../configuracion/sources/configuracion.demo";
import { detalleDemoSource } from "../../detalle/sources/detalle.demo";
import { detalleRealSource } from "../../detalle/sources/detalle.source";
import {
  equipoConfirmadorasDemoSource,
  equipoVendedorasDemoSource,
} from "../../equipo/sources/equipo.demo";
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
import { misVentasDemoSource } from "../../mis-ventas/sources/mis-ventas.demo";
import {
  operacionesColaDemoSource,
  operacionesCouriersDemoSource,
  operacionesInventarioDemoSource,
} from "../../operaciones/sources/operaciones.demo";
import { productosDemoSource } from "../../productos/sources/productos.demo";
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
  detalle: [detalleRealSource, detalleDemoSource],
  "config-metas": configMetasDemoSource,
  "canales-comparativo": canalesComparativoDemoSource,
  "canales-detalle": canalesDetalleDemoSource,
  productos: productosDemoSource,
  publicidad: publicidadDemoSource,
  "clientes-zonas": clientesZonasDemoSource,
  callcenter: callCenterDemoSource,
  "operaciones-cola": operacionesColaDemoSource,
  "operaciones-couriers": operacionesCouriersDemoSource,
  "operaciones-inventario": operacionesInventarioDemoSource,
  "finanzas-resultado": finanzasResultadoDemoSource,
  "finanzas-caja": finanzasCajaDemoSource,
  "finanzas-cobranza": finanzasCobranzaDemoSource,
  "equipo-vendedoras": equipoVendedorasDemoSource,
  "equipo-confirmadoras": equipoConfirmadorasDemoSource,
  "mis-ventas": misVentasDemoSource,
  "config-estados": configEstadosDemoSource,
  "config-cuadres": configCuadresDemoSource,
  "exportacion-libro": exportacionLibroDemoSource,
  "compartir-reporte": compartirReporteDemoSource,
});
