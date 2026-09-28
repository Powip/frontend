import {
  defineContract,
  REGLA_VENTA_PENDIENTE,
  ROLES_GESTION,
} from "../shared/data/contract-helpers";

export const CLIENTES_ZONAS_CONTRACT = defineContract({
  id: "clientes-zonas",
  titulo: "Clientes y zonas",
  metodo: "GET",
  endpoint: "/panel/clientes",
  estado: "pendiente",
  pantallas: ["canales"],
  roles: ROLES_GESTION,
  respuesta: "PanelEnvelope<ClientesZonasPanel>",
  pendientes: [
    "Recompra y valor histórico necesitan el historial completo del cliente, no solo el periodo",
    "Lista negra = clientes con al menos un RECHAZADO anterior; RECHAZADO no existe hoy como estado",
    "Zona Lima/Provincia: salesRegion existe en el pedido (LIMA/PROVINCIA)",
    REGLA_VENTA_PENDIENTE,
  ],
});
