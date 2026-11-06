import {
  COMPARACION_PENDIENTE,
  defineContract,
  REGLA_VENTA_PENDIENTE,
  ROLES_GESTION,
} from "../shared/data/contract-helpers";

export const RESUMEN_CONTRACT = defineContract({
  id: "resumen",
  titulo: "Resumen",
  metodo: "GET",
  endpoint: "/panel/resumen",
  endpointActual: "GET /panel/resumen (ms-ventas)",
  estado: "parcial",
  pantallas: ["resumen"],
  roles: ROLES_GESTION,
  camposRestringidos: ["actual.gane", "actual.ventasPorCanal[].retornoPublicidad"],
  respuesta: "PanelEnvelope<ResumenPanel>",
  pendientes: [
    REGLA_VENTA_PENDIENTE,
    "CONECTADO: Vendí, Entregado, Me deben, ventas diarias y por canal, clientes, flujo y las tareas leads sin llamar, ventas sin guía y anulaciones sin motivo. La venta es la «venta confirmada» de /ventas; Incompleto y Preventa no cuentan",
    "Ventas por canal atribuidas al canal de origen; el canal de cierre es solo informativo y nunca suma dos veces",
    "PENDIENTE: Gané requiere pauta por canal y día, y costo unitario nullable por ítem (sin costo → null, nunca 0)",
    "PENDIENTE: inventario (agotados y críticos) requiere stock reservado por pedido",
    "RECHAZADO se reconoce como venta confirmada y despachada que se anuló (salvo falta de stock) mientras no exista el estado",
    "Me deben · vencido requiere plazo de liquidación por courier",
    "Acciones «Envíos retrasados» requieren tiempo normal de entrega por courier",
    COMPARACION_PENDIENTE,
  ],
});
