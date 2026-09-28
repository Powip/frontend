import { ACCIONES_PEDIDO_CONTRACT } from "../../acciones/acciones.contract";
import { OPCIONES_ASESORES_CONTRACT } from "../../asesores/asesores.contract";
import { CALLCENTER_CONTRACT } from "../../call-center/call-center.contract";
import {
  CANALES_COMPARATIVO_CONTRACT,
  CANALES_DETALLE_CONTRACT,
  CANALES_FICHAS_CONTRACT,
  CANALES_FICHAS_GUARDAR_CONTRACT,
} from "../../canales/canales.contracts";
import { CLIENTES_ZONAS_CONTRACT } from "../../clientes-zonas/clientes-zonas.contract";
import {
  CONFIG_CUADRES_CONTRACT,
  CONFIG_ESTADOS_CONTRACT,
  CONFIG_METAS_CONTRACT,
  CONFIG_METAS_GUARDAR_CONTRACT,
} from "../../configuracion/configuracion.contracts";
import { DETALLE_CONTRACT } from "../../detalle/detalle.contract";
import {
  EQUIPO_CONFIRMADORAS_CONTRACT,
  EQUIPO_VENDEDORAS_CONTRACT,
} from "../../equipo/equipo.contracts";
import { ESTADO_PERIODO_CONTRACT } from "../../estado-periodo/estado-periodo.contract";
import {
  COMPARTIR_REPORTE_CONTRACT,
  EXPORTACION_LIBRO_CONTRACT,
} from "../../exportacion/exportacion.contracts";
import {
  FINANZAS_CAJA_CONTRACT,
  FINANZAS_COBRANZA_CONTRACT,
  FINANZAS_RESULTADO_CONTRACT,
} from "../../finanzas/finanzas.contracts";
import { MIS_VENTAS_CONTRACT } from "../../mis-ventas/mis-ventas.contract";
import {
  OPERACIONES_COLA_CONTRACT,
  OPERACIONES_COURIERS_CONTRACT,
  OPERACIONES_INVENTARIO_CONTRACT,
} from "../../operaciones/operaciones.contracts";
import { PRODUCTOS_CONTRACT } from "../../productos/productos.contract";
import { PUBLICIDAD_CONTRACT } from "../../publicidad/publicidad.contract";
import { RESUMEN_CONTRACT } from "../../resumen/resumen.contract";
import type { PanelContractDescriptor, PanelContractId } from "../models/panel-contract.model";
import type { PanelTabId } from "../models/panel-navigation.model";

export const PANEL_CONTRACTS: Record<PanelContractId, PanelContractDescriptor> = {
  "estado-periodo": ESTADO_PERIODO_CONTRACT,
  resumen: RESUMEN_CONTRACT,
  "canales-fichas": CANALES_FICHAS_CONTRACT,
  "canales-fichas-guardar": CANALES_FICHAS_GUARDAR_CONTRACT,
  "canales-comparativo": CANALES_COMPARATIVO_CONTRACT,
  "canales-detalle": CANALES_DETALLE_CONTRACT,
  productos: PRODUCTOS_CONTRACT,
  publicidad: PUBLICIDAD_CONTRACT,
  "clientes-zonas": CLIENTES_ZONAS_CONTRACT,
  callcenter: CALLCENTER_CONTRACT,
  "operaciones-cola": OPERACIONES_COLA_CONTRACT,
  "operaciones-couriers": OPERACIONES_COURIERS_CONTRACT,
  "operaciones-inventario": OPERACIONES_INVENTARIO_CONTRACT,
  "finanzas-resultado": FINANZAS_RESULTADO_CONTRACT,
  "finanzas-caja": FINANZAS_CAJA_CONTRACT,
  "finanzas-cobranza": FINANZAS_COBRANZA_CONTRACT,
  "equipo-vendedoras": EQUIPO_VENDEDORAS_CONTRACT,
  "equipo-confirmadoras": EQUIPO_CONFIRMADORAS_CONTRACT,
  "mis-ventas": MIS_VENTAS_CONTRACT,
  "config-metas": CONFIG_METAS_CONTRACT,
  "config-metas-guardar": CONFIG_METAS_GUARDAR_CONTRACT,
  "config-estados": CONFIG_ESTADOS_CONTRACT,
  "config-cuadres": CONFIG_CUADRES_CONTRACT,
  detalle: DETALLE_CONTRACT,
  "acciones-pedido": ACCIONES_PEDIDO_CONTRACT,
  "exportacion-libro": EXPORTACION_LIBRO_CONTRACT,
  "compartir-reporte": COMPARTIR_REPORTE_CONTRACT,
  "opciones-asesores": OPCIONES_ASESORES_CONTRACT,
};

export function contractsForTab(tab: PanelTabId): PanelContractDescriptor[] {
  return Object.values(PANEL_CONTRACTS).filter((descriptor) => descriptor.pantallas.includes(tab));
}
