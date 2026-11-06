import {
  defineContract,
  REGLA_VENTA_PENDIENTE,
  ROLES_GESTION,
} from "../shared/data/contract-helpers";

export const EQUIPO_VENDEDORAS_CONTRACT = defineContract({
  id: "equipo-vendedoras",
  titulo: "Vendedoras y caja",
  metodo: "GET",
  endpoint: "/panel/equipo?tipo=vendedoras&agrupar=zona|asesora&upsell=con|sin",
  endpointActual: "GET /panel/equipo?tipo=vendedoras (ms-ventas)",
  estado: "parcial",
  pantallas: ["equipo"],
  roles: ROLES_GESTION,
  camposRestringidos: ["metricas.comisionEstimada"],
  respuesta: "PanelEnvelope<EquipoVendedorasPanel>",
  pendientes: [
    "CONECTADO: ventas que no entraron como lead, por asesora (sellerId) o zona; pagado, pendiente (por liquidar + en curso) y perdido (rechazado + reembolsado); upsell y ticket entregado",
    "Ventas sin asesora (web, marketplace) van en «automáticas», fuera del cuadro; rol caja = mayoría de ventas presenciales",
    "PENDIENTE: metas mensuales por vendedora y reglas de comisión (no hay configuración)",
    REGLA_VENTA_PENDIENTE,
  ],
});

export const EQUIPO_CONFIRMADORAS_CONTRACT = defineContract({
  id: "equipo-confirmadoras",
  titulo: "Confirmadoras",
  metodo: "GET",
  endpoint: "/panel/equipo?tipo=confirmadoras",
  endpointActual: "GET /panel/equipo?tipo=confirmadoras (ms-ventas)",
  estado: "parcial",
  pantallas: ["equipo"],
  roles: ROLES_GESTION,
  camposRestringidos: ["filas[].comisionEstimada", "reglaComision"],
  respuesta: "PanelEnvelope<EquipoConfirmadorasPanel>",
  pendientes: [
    "CONECTADO: mismo cálculo que el ranking de Call center; asesora del lead = ccAgenteId (o el vendedor si pasó por etapa comercial)",
    "Contactación no aplica (contactado = llamado); tiempo a 1ª llamada pendiente (falta primer_contacto_at)",
    "PENDIENTE: meta mensual por confirmadora y regla de comisión (no hay configuración)",
  ],
});
