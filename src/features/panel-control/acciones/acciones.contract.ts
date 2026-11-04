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
    "No se hace POST /panel/acciones (decisión del producto): los botones enlazan a las pantallas existentes (pedidos, guías, liquidaciones, atención al cliente) o abren WhatsApp con el mensaje listo",
    "Enlaces: preparar y asignar guía → /operaciones/pedidos; coordinar recojo → /operaciones/guias; reclamar al courier y pedir liquidación → /operaciones/liquidaciones; llamar → /atencion-cliente; avisar al cliente → WhatsApp (el detalle no trae teléfono: se elige el contacto)",
    "Sin destino todavía (siguen como «Pendiente»): completar motivo y asignar canal",
  ],
});
