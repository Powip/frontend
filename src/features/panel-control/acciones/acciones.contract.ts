import { defineContract, ROLES_TODOS } from "../shared/data/contract-helpers";

export const ACCIONES_PEDIDO_CONTRACT = defineContract({
  id: "acciones-pedido",
  titulo: "Acciones sobre pedidos",
  metodo: "POST",
  endpoint: "/panel/acciones",
  estado: "pendiente",
  pantallas: ["resumen", "callcenter", "operaciones", "finanzas", "configuracion"],
  filtros: [],
  roles: ROLES_TODOS,
  respuesta: "AccionPedidoResponse",
  pendientes: [
    "Llamar, asignar guía, pedir liquidación, avisar al cliente, reclamar al courier, completar motivo, preparar, coordinar recojo, asignar canal",
    "Cada acción debe validar permisos del usuario en el backend (OPS_* u otros)",
    "Alternativa: redirigir a los módulos existentes (Call Center, Pedidos, Liquidaciones) en lugar de un endpoint nuevo",
  ],
});
