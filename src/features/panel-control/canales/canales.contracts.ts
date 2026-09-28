import {
  COMPARACION_PENDIENTE,
  defineContract,
  REGLA_VENTA_PENDIENTE,
  ROLES_DUENO,
  ROLES_GESTION,
  ROLES_TODOS,
} from "../shared/data/contract-helpers";

export const CANALES_FICHAS_CONTRACT = defineContract({
  id: "canales-fichas",
  titulo: "Fichas de canal",
  metodo: "GET",
  endpoint: "/config/canales?empresaId=",
  endpointActual: "/config/canales?empresaId= (ms-ventas)",
  estado: "parcial",
  pantallas: ["canales", "configuracion"],
  filtros: [],
  roles: ROLES_TODOS,
  respuesta: "CanalFicha[]",
  pendientes: [
    "Hoy solo trae canalNombre, canalLabel, flujoEntrada, requiereConfirmacionCc y activo",
    "Faltan: familia, color, cobro (cod|pre|inm|mkp), usa_courier, comision_pct, pasarela_pct, recibe_pauta_general, meta_mensual, tiene_pedidos",
    "flujoEntrada = directo_operaciones no distingue venta directa de presencial (POS); se muestra como pendiente",
    "Falta la relación pedido → canal: salesChannel, canalOrigen y externalSource no apuntan a un id de ficha",
  ],
});

export const CANALES_FICHAS_GUARDAR_CONTRACT = defineContract({
  id: "canales-fichas-guardar",
  titulo: "Crear o editar ficha de canal",
  metodo: "PUT",
  endpoint: "/config/canales/{id}",
  endpointActual:
    "PUT /config/canales/{id} y POST /config/canales (solo flujoEntrada, datosRequeridos, activo)",
  estado: "pendiente",
  pantallas: ["configuracion"],
  filtros: [],
  roles: ROLES_DUENO,
  capacidadRequerida: "editar_configuracion",
  respuesta: "CanalFicha",
  pendientes: [
    "Bloquear entrada, cobro y usa_courier cuando el canal ya tiene pedidos (validación en backend)",
    "Eliminar solo si el canal no tiene pedidos",
  ],
});

export const CANALES_COMPARATIVO_CONTRACT = defineContract({
  id: "canales-comparativo",
  titulo: "Comparativo de canales",
  metodo: "GET",
  endpoint: "/panel/canales?vista=ventas|entregas|ganancia",
  estado: "pendiente",
  pantallas: ["canales"],
  roles: ROLES_GESTION,
  camposRestringidos: ["vista=ganancia (solo Dueño)"],
  respuesta: "PanelEnvelope<CanalesComparativo>",
  pendientes: [
    REGLA_VENTA_PENDIENTE,
    "vista=ganancia debe responder 403 a roles sin permiso de costos",
    "Tendencia semanal: 3 familias con mayor facturación + «Otras»",
    COMPARACION_PENDIENTE,
  ],
});

export const CANALES_DETALLE_CONTRACT = defineContract({
  id: "canales-detalle",
  titulo: "Detalle de canal",
  metodo: "GET",
  endpoint: "/panel/canales/{id}",
  estado: "pendiente",
  pantallas: ["canales"],
  roles: ROLES_GESTION,
  camposRestringidos: ["actual.costos"],
  respuesta: "PanelEnvelope<CanalDetalle>",
  pendientes: [
    "Bloque específico según la ficha: embudo (lead), sesiones (live), cierre de caja (presencial), liquidación (marketplace), prepago, por vendedora (conversacional)",
    "Sesiones de TikTok Live requieren la tabla de lives con inversión manual (no existe)",
  ],
});
