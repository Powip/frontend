import { defineContract, ROLES_GESTION } from "../shared/data/contract-helpers";

export const OPERACIONES_COLA_CONTRACT = defineContract({
  id: "operaciones-cola",
  titulo: "Cola y tiempos",
  metodo: "GET",
  endpoint: "/panel/operaciones?sub=cola",
  endpointActual: "GET /panel/operaciones?sub=cola (ms-ventas)",
  estado: "parcial",
  pantallas: ["operaciones"],
  roles: ROLES_GESTION,
  respuesta: "PanelEnvelope<ColaPanel>",
  pendientes: [
    "CONECTADO: cola por estado y antigüedad (estado actual, de cualquier fecha de ingreso), tiempos por etapa con la fecha de cada cambio de estado, despachos por día (por fecha de despacho) y motivos de rechazo",
    "Solo Dueño: a otro rol el servidor responde 403. Cada subpestaña es una petición propia (?sub=)",
    "La cola cuenta ventas con courier; el estado ASIGNADO_A_GUIA se muestra como CON_GUIA",
    "Los grupos del drawer (cola_operativa, etapa_lenta, despachados_dia) usan las mismas funciones que la pantalla, así que cada cifra abre exactamente sus pedidos",
    "PENDIENTE (Task 15c): los drawers «Envíos retrasados» (accion: envios_retrasados) y «Sin guía +24 h» (accion: sin_guia_24h) todavía responden 400. «Sin guía +24 h» NO usa ventas_sin_guia (el universo del Resumen, sin exigir courier y de 14 días): la tarjeta cuenta ventas con courier en LLAMADO/PREPARADO de hace más de 24 h; envíos retrasados requiere el tiempo normal por courier (panel_courier_config)",
    "Incidencia, motivos de rechazo y efectividad abren envios {estado: RECHAZADO[, tipo, motivo]}: son rechazos CON courier, que es lo que cuentan las cifras (el grupo rechazados incluye los que no tienen courier)",
    "PENDIENTE: metas por etapa (sin configuración: usa las del contrato) y la comparación con el periodo anterior",
  ],
});

export const OPERACIONES_COURIERS_CONTRACT = defineContract({
  id: "operaciones-couriers",
  titulo: "Couriers",
  metodo: "GET",
  endpoint: "/panel/operaciones?sub=couriers",
  endpointActual: "GET /panel/operaciones?sub=couriers (ms-ventas)",
  estado: "parcial",
  pantallas: ["operaciones"],
  roles: ROLES_GESTION,
  camposRestringidos: [
    "actual.kpis.fleteTotal",
    "actual.kpis.fletePromedio",
    "actual.kpis.enviosSinFlete",
    "actual.couriers[].fletePromedio",
    "actual.couriers[].fleteTotal",
    "actual.couriers[].costoRechazos",
    "actual.departamentos[].fletePromedio",
  ],
  respuesta: "PanelEnvelope<CouriersPanel>",
  pendientes: [
    "CONECTADO: envíos, efectividad, días de entrega, score, departamentos y lo que falta liquidar (estado actual)",
    "Solo Dueño: a otro rol el servidor responde 403",
    "Flete: fleteTotal, fletePromedio y costoRechazos son null (no 0) si ningún envío tiene flete informado; enviosSinFlete cuenta los que no lo tienen. Sin ver_costos las claves se omiten",
    "Por liquidar y vencido salen de «entregados con courier sin liquidar» de los últimos 365 días (hasta 5000 pedidos), no de la ventana de 60 días de la cobranza",
    "El plazo de liquidación y el tiempo normal salen de panel_courier_config; un courier sin plazo muestra «Pendiente»",
    "Rechazos por departamento: el drawer abre envios {departamento, estado: RECHAZADO}, que cuadra con la fila",
    "PENDIENTE: entrega al primer intento (falta primer_intento_entrega_ok; llega null) y flete de retorno en rechazos de provincia",
  ],
});

export const OPERACIONES_INVENTARIO_CONTRACT = defineContract({
  id: "operaciones-inventario",
  titulo: "Inventario",
  metodo: "GET",
  endpoint: "/panel/operaciones?sub=inventario",
  endpointActual: "GET /panel/operaciones?sub=inventario (ms-ventas)",
  estado: "parcial",
  pantallas: ["operaciones", "resumen"],
  roles: ROLES_GESTION,
  camposRestringidos: [
    "actual.kpis.valorAlCosto",
    "actual.productos[].costoUnitario",
    "actual.productos[].valor",
  ],
  respuesta: "PanelEnvelope<InventarioPanel>",
  pendientes: [
    "CONECTADO: stock de ms-logistics, reservado por ventas en LLAMADO/PREPARADO/CON_GUIA, venta diaria de los últimos 30 días y cobertura; stock < 0 es «Error de datos»",
    "Solo Dueño. Si ms-logistics no responde el servidor devuelve 503: la pestaña muestra «Inventario no disponible por ahora» con Reintentar, sin afectar a Cola ni a Couriers",
    "«Tienda» es la tienda física del stock (como en logistics), distinta de la tienda de venta que filtran Cola y Couriers",
    "Costos: salen de las ventas de los últimos 180 días, así que valorAlCosto es parcial; sinCosto cuenta los productos sin costo. Sin ver_costos las claves se omiten",
    "reservados {producto}: lista los pedidos de todas las tiendas que tienen ese producto (el parámetro es solo el producto); 404 si ya no está en el inventario, 503 si logistics no responde",
    "PENDIENTE: el drawer «Ventas esperando stock» (accion: productos_agotados) todavía responde 400",
  ],
});
