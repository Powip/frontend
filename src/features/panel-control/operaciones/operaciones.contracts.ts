import { defineContract, ROLES_GESTION } from "../shared/data/contract-helpers";

export const OPERACIONES_COLA_CONTRACT = defineContract({
  id: "operaciones-cola",
  titulo: "Cola y tiempos",
  metodo: "GET",
  endpoint: "/panel/operaciones?sub=cola",
  estado: "pendiente",
  pantallas: ["operaciones"],
  roles: ROLES_GESTION,
  respuesta: "PanelEnvelope<ColaPanel>",
  pendientes: [
    "Cola activa y matriz estado × antigüedad son estado actual (no dependen del periodo)",
    "Tiempos por etapa necesitan la fecha de cada cambio de estado; hoy solo se aproximan con logs[].data.status",
    "Los estados reales incluyen ASIGNADO_A_GUIA; el contrato usa CON_GUIA",
    "Envíos retrasados requieren tiempo normal por courier",
  ],
});

export const OPERACIONES_COURIERS_CONTRACT = defineContract({
  id: "operaciones-couriers",
  titulo: "Couriers",
  metodo: "GET",
  endpoint: "/panel/operaciones?sub=couriers",
  estado: "pendiente",
  pantallas: ["operaciones"],
  roles: ROLES_GESTION,
  respuesta: "PanelEnvelope<CouriersPanel>",
  pendientes: [
    "Plazo de liquidación y tiempo normal por courier (hoy son una tabla local en Liquidaciones COD)",
    "Entrega al primer intento requiere primer_intento_entrega_ok",
    "Flete de retorno en rechazos de provincia",
  ],
});

export const OPERACIONES_INVENTARIO_CONTRACT = defineContract({
  id: "operaciones-inventario",
  titulo: "Inventario",
  metodo: "GET",
  endpoint: "/panel/operaciones?sub=inventario",
  estado: "pendiente",
  pantallas: ["operaciones", "resumen"],
  roles: ROLES_GESTION,
  camposRestringidos: [
    "actual.kpis.valorAlCosto",
    "actual.productos[].costoUnitario",
    "actual.productos[].valor",
  ],
  respuesta: "PanelEnvelope<InventarioPanel>",
  pendientes: [
    "Stock reservado por ventas en LLAMADO/PREPARADO",
    "Venta diaria de los últimos 30 días por producto",
    "Stock < 0 se informa como «Error de datos»",
  ],
});
