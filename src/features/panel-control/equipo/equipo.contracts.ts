import {
  defineContract,
  REGLA_VENTA_PENDIENTE,
  ROLES_GESTION,
} from "../shared/data/contract-helpers";

export const EQUIPO_VENDEDORAS_CONTRACT = defineContract({
  id: "equipo-vendedoras",
  titulo: "Vendedoras y caja",
  metodo: "GET",
  endpoint: "/panel/equipo?tipo=vendedoras&agrupar=zona|asesor&upsell=con|sin",
  estado: "pendiente",
  pantallas: ["equipo"],
  roles: ROLES_GESTION,
  camposRestringidos: ["metricas.comisionEstimada"],
  respuesta: "PanelEnvelope<EquipoVendedorasPanel>",
  pendientes: [
    "Pendiente separado de perdido; ticket = entregado ÷ entregas",
    "Ventas automáticas (web, marketplace) aparte y fuera de comisiones",
    "Metas mensuales por vendedora y reglas de comisión configurables",
    "Asesor de venta directa = sellerId; falta confirmar el campo para caja POS",
    REGLA_VENTA_PENDIENTE,
  ],
});

export const EQUIPO_CONFIRMADORAS_CONTRACT = defineContract({
  id: "equipo-confirmadoras",
  titulo: "Confirmadoras",
  metodo: "GET",
  endpoint: "/panel/equipo?tipo=confirmadoras",
  estado: "pendiente",
  pantallas: ["equipo"],
  roles: ROLES_GESTION,
  camposRestringidos: ["filas[].comisionEstimada", "reglaComision"],
  respuesta: "PanelEnvelope<EquipoConfirmadorasPanel>",
  pendientes: [
    "Fuente existente aprovechable: /atencion-al-cliente/agentes/kpis (asignados, contactados, confirmados, entregados)",
    "Asesor de lead = ccAgenteId; confirmar con backend",
    "Meta mensual por confirmadora en número de confirmados",
  ],
});
