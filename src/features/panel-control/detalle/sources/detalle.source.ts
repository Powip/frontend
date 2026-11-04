import { getPanel } from "../../shared/api/panel-http";
import type { PanelSource } from "../../shared/data/panel-source";
import type { DetalleResponse } from "../models/detalle.model";

export const detalleRealSource: PanelSource<"detalle"> = {
  contractId: "detalle",
  kind: "real",
  pestanas: ["resumen"],
  descripcion:
    "GET /panel/detalle (ms-ventas): pedidos detrás de cada cifra del Resumen, con búsqueda y paginación en el servidor. Los grupos de otras pestañas responden 400 hasta conectarlos",
  fetch: (query) => getPanel<DetalleResponse>("detalle", query),
};

/** El mismo endpoint, para la subpestaña Canales de Ventas y canales (las demás siguen en demo). */
export const detalleCanalesRealSource: PanelSource<"detalle"> = {
  ...detalleRealSource,
  pestanas: ["canales"],
  subpestanas: ["canales"],
  descripcion:
    "GET /panel/detalle (ms-ventas): pedidos detrás de cada cifra de Canales. Productos, Publicidad y Clientes siguen en demo",
};

/** El mismo endpoint, para la subpestaña Productos de Ventas y canales. */
export const detalleProductosRealSource: PanelSource<"detalle"> = {
  ...detalleRealSource,
  pestanas: ["canales"],
  subpestanas: ["productos"],
  descripcion:
    "GET /panel/detalle (ms-ventas): pedidos que contienen el producto, cupón o categoría clicado. Publicidad y Clientes siguen en demo",
};

/** El mismo endpoint, para la pestaña Call center. */
export const detalleCallCenterRealSource: PanelSource<"detalle"> = {
  ...detalleRealSource,
  pestanas: ["callcenter"],
  descripcion:
    "GET /panel/detalle (ms-ventas): leads, confirmados, anulados por motivo, cola por antigüedad, duplicados, lista negra, celda del mapa de calor y fila del ranking",
};

/** El mismo endpoint, para Mis ventas (el servidor impone la identidad de la vendedora). */
export const detalleMisVentasRealSource: PanelSource<"detalle"> = {
  ...detalleRealSource,
  pestanas: ["misventas"],
  descripcion:
    "GET /panel/detalle (ms-ventas): las ventas, pagos y pedidos por estado de la vendedora",
};

/** El mismo endpoint, para la pestaña Equipo. */
export const detalleEquipoRealSource: PanelSource<"detalle"> = {
  ...detalleRealSource,
  pestanas: ["equipo"],
  descripcion:
    "GET /panel/detalle (ms-ventas): ventas, entregados, cobrado, pendiente, rechazados y upsell de cada vendedora o zona, y los leads de cada confirmadora",
};

/** El mismo endpoint, para la subpestaña Clientes de Ventas y canales. */
export const detalleClientesRealSource: PanelSource<"detalle"> = {
  ...detalleRealSource,
  pestanas: ["canales"],
  subpestanas: ["clientes"],
  descripcion:
    "GET /panel/detalle (ms-ventas): pedidos de una zona, departamento o método de pago, clientes nuevos, recurrentes y lista negra, y el historial completo de un cliente. Solo Publicidad sigue en demo",
};

/**
 * El mismo endpoint, para la pestaña Operaciones. Los cuatro grupos propios (`cola_operativa`,
 * `etapa_lenta`, `despachados_dia`, `reservados`) son solo del Dueño: a otro rol el servidor responde 403.
 * `primera_llamada_tardia` no se abre desde aquí (es de Call center y sigue sin conectar: 400).
 */
export const detalleOperacionesRealSource: PanelSource<"detalle"> = {
  ...detalleRealSource,
  pestanas: ["operaciones"],
  descripcion:
    "GET /panel/detalle (ms-ventas): pedidos de cada celda de la cola, etapa lenta, día de despacho, reserva de un producto, y los envíos, rechazos y deuda de cada courier o departamento",
};

/**
 * El mismo endpoint, para la pestaña Finanzas (solo Dueño). `movimientos_caja` abre los pedidos detrás
 * de un concepto o día de Caja (por la fecha del dinero); `por_liquidar_actual` y `por_cobrar_actual`,
 * lo que muestra Cobranza (estado actual); el resto, los grupos del periodo de Resultado.
 */
export const detalleFinanzasRealSource: PanelSource<"detalle"> = {
  ...detalleRealSource,
  pestanas: ["finanzas"],
  descripcion:
    "GET /panel/detalle (ms-ventas): pedidos detrás de las cifras de Resultado, de cada movimiento de Caja y de la deuda de Cobranza. Solo Dueño",
};
