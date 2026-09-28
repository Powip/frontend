import { defineContract, ROLES_TODOS } from "../shared/data/contract-helpers";

export const DETALLE_CONTRACT = defineContract({
  id: "detalle",
  titulo: "Detalle de pedidos (drawer)",
  metodo: "GET",
  endpoint: "/panel/detalle?grupo=…&grupo_params=…&pagina=…&tamano_pagina=…&buscar=…",
  estado: "pendiente",
  pantallas: ["resumen", "canales", "callcenter", "operaciones", "finanzas", "equipo", "misventas"],
  roles: ROLES_TODOS,
  camposRestringidos: ["porProducto[].margen"],
  respuesta: "DetalleResponse",
  pendientes: [
    "Catálogo de grupos en docs/panel-control/README.md §4.1: cada tarjeta, barra, caja o tarea abre un grupo con sus parámetros",
    "resumen, porProducto y porEstado se calculan sobre el grupo completo; pedidos.total cuenta las coincidencias de buscar",
    "Búsqueda y paginación en el servidor: el frontend pide páginas de 100 y el Excel páginas de 500 hasta completar el total",
    "Los grupos de «Qué hacer hoy» y espera_producto usan el estado actual e ignoran desde/hasta",
    "Cada fila informa canal de origen y, aparte, canal de cierre; estado de la especificación y estado de cobro separados",
  ],
});
