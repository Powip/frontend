import {
  COMPARACION_PENDIENTE,
  defineContract,
  REGLA_VENTA_PENDIENTE,
} from "../shared/data/contract-helpers";

export const MIS_VENTAS_CONTRACT = defineContract({
  id: "mis-ventas",
  titulo: "Mis ventas",
  metodo: "GET",
  endpoint: "/panel/mis-ventas",
  endpointActual: "GET /panel/mis-ventas (ms-ventas)",
  estado: "parcial",
  pantallas: ["misventas"],
  roles: ["vendedora", "dueno"],
  respuesta: "PanelEnvelope<MisVentasPanel>",
  pendientes: [
    "CONECTADO: lo vendido, pagado, efectividad y perdido de sus ventas directas y POS, sus pedidos por estado, ranking anónimo («Vendedora N») y no cobrados",
    "Con rol Vendedora el backend impone asesor = usuario del JWT; el Dueño solo la ve con ver_como=vendedora + asesor",
    "La meta viene de Configuración › Metas; no hay comisión en Mis ventas (la Vendedora no recibe comisiones)",
    REGLA_VENTA_PENDIENTE,
    COMPARACION_PENDIENTE,
  ],
});
