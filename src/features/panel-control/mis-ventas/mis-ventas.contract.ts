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
  estado: "pendiente",
  pantallas: ["misventas"],
  roles: ["vendedora", "dueno"],
  respuesta: "PanelEnvelope<MisVentasPanel>",
  pendientes: [
    "La especificación no lista este endpoint en §13.2; el frontend lo necesita para la vista Vendedora",
    "Con rol Vendedora el backend fuerza asesor = usuario del JWT; el Dueño puede previsualizar con ver_como + asesor",
    "El ranking muestra la facturación de otras vendedoras: confirmar que la vendedora puede verlo",
    REGLA_VENTA_PENDIENTE,
    COMPARACION_PENDIENTE,
  ],
});
