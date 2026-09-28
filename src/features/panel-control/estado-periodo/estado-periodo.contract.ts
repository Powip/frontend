import {
  defineContract,
  REGLA_VENTA_PENDIENTE,
  ROLES_TODOS,
} from "../shared/data/contract-helpers";

export const ESTADO_PERIODO_CONTRACT = defineContract({
  id: "estado-periodo",
  titulo: "Línea de estado del periodo",
  metodo: "GET",
  endpoint: "/panel/estado",
  estado: "pendiente",
  pantallas: [
    "resumen",
    "canales",
    "callcenter",
    "operaciones",
    "finanzas",
    "equipo",
    "misventas",
    "configuracion",
  ],
  roles: ROLES_TODOS,
  camposRestringidos: ["actual.calidad (solo Dueño)"],
  respuesta: "PanelEnvelope<EstadoPeriodo>",
  pendientes: [
    "La especificación §13.2 ubica la línea de estado dentro de /panel/resumen; el frontend la necesita en todas las pestañas, por eso se propone un contrato propio",
    "Periodo abierto = pedidos del periodo en PENDIENTE, en curso o por liquidar ÷ pedidos del periodo (fecha_ingreso)",
    REGLA_VENTA_PENDIENTE,
  ],
});
