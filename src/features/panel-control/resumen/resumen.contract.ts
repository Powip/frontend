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
  estado: "pendiente",
  pantallas: ["resumen"],
  roles: ROLES_GESTION,
  camposRestringidos: ["actual.gane", "actual.ventasPorCanal[].retornoPublicidad"],
  respuesta: "PanelEnvelope<ResumenPanel>",
  pendientes: [
    REGLA_VENTA_PENDIENTE,
    "Ventas diarias y totales por fecha_ingreso (created_at) con corte 00:00 America/Lima; /stats/summary no sirve porque suma pedidos PENDIENTE",
    "Ventas por canal atribuidas al canal de origen; el canal de cierre es solo informativo y nunca suma dos veces",
    "Gané requiere pauta por canal y día, y costo unitario nullable por ítem (sin costo → null, nunca 0)",
    "Me deben · vencido requiere plazo de liquidación por courier",
    "Acciones «Envíos retrasados» requieren tiempo normal de entrega por courier",
    COMPARACION_PENDIENTE,
  ],
});
