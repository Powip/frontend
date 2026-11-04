import { defineContract, ROLES_DUENO } from "../shared/data/contract-helpers";

export const CONFIG_METAS_CONTRACT = defineContract({
  id: "config-metas",
  titulo: "Metas",
  metodo: "GET",
  endpoint: "/config/metas",
  endpointActual: "/config/metas (ms-ventas)",
  estado: "conectado",
  pantallas: ["configuracion"],
  filtros: [],
  roles: ROLES_DUENO,
  capacidadRequerida: "ver_configuracion",
  respuesta: "ConfigMetas",
  pendientes: [
    "Las metas de unidad porcentaje viajan como fracción 0..1 (0.82 = 82 %)",
    "El Resumen, Equipo, Canales y Mis ventas reciben las metas dentro de su propio sobre",
  ],
});

export const CONFIG_METAS_GUARDAR_CONTRACT = defineContract({
  id: "config-metas-guardar",
  titulo: "Guardar metas",
  metodo: "PUT",
  endpoint: "/config/metas",
  endpointActual: "/config/metas (ms-ventas)",
  estado: "conectado",
  pantallas: ["configuracion"],
  filtros: [],
  roles: ROLES_DUENO,
  capacidadRequerida: "editar_configuracion",
  respuesta: "ConfigMetas",
  pendientes: [
    "Solo se envían las metas modificadas; una meta cargada no se puede borrar (solo cambiar)",
  ],
});

export const CONFIG_COMISIONES_CONTRACT = defineContract({
  id: "config-comisiones",
  titulo: "Comisiones del equipo",
  metodo: "GET",
  endpoint: "/config/comisiones",
  endpointActual: "/config/comisiones (ms-ventas); guarda con PUT /config/comisiones",
  estado: "conectado",
  pantallas: ["configuracion"],
  filtros: [],
  roles: ROLES_DUENO,
  capacidadRequerida: "ver_configuracion",
  respuesta: "ConfigComisiones",
  pendientes: [
    "Conceptos que lee el panel: confirmadora por_entrega (S/) y pct_upsell (%); vendedora pct_pagado (%) y pct_upsell (%). Los % se guardan de 0 a 100",
  ],
});

export const CONFIG_GASTOS_FIJOS_CONTRACT = defineContract({
  id: "config-gastos-fijos",
  titulo: "Gastos fijos por tienda",
  metodo: "GET",
  endpoint: "/config/gastos-fijos",
  endpointActual: "/config/gastos-fijos (ms-ventas); guarda con PUT /config/gastos-fijos",
  estado: "conectado",
  pantallas: ["configuracion"],
  filtros: [],
  roles: ROLES_DUENO,
  capacidadRequerida: "ver_configuracion",
  respuesta: "ConfigGastosFijos",
  pendientes: [],
});

export const CONFIG_COURIERS_CONTRACT = defineContract({
  id: "config-couriers",
  titulo: "Plazos de courier",
  metodo: "GET",
  endpoint: "/config/couriers",
  endpointActual: "/config/couriers (ms-ventas); guarda con PUT /config/couriers",
  estado: "conectado",
  pantallas: ["configuracion"],
  filtros: [],
  roles: ROLES_DUENO,
  capacidadRequerida: "ver_configuracion",
  respuesta: "ConfigCouriers",
  pendientes: [],
});

export const CONFIG_ESTADOS_CONTRACT = defineContract({
  id: "config-estados",
  titulo: "Conteo actual por estado",
  metodo: "GET",
  endpoint: "/panel/config/estados",
  endpointActual: "/panel/config/estados (ms-ventas)",
  estado: "conectado",
  pantallas: ["configuracion"],
  roles: ROLES_DUENO,
  capacidadRequerida: "ver_configuracion",
  respuesta: "PanelEnvelope<ConfigEstados>",
  pendientes: [],
});

export const CONFIG_CUADRES_CONTRACT = defineContract({
  id: "config-cuadres",
  titulo: "Cuadres y calidad de datos",
  metodo: "GET",
  endpoint: "/panel/config/cuadres",
  endpointActual: "/panel/config/cuadres (ms-ventas)",
  estado: "conectado",
  pantallas: ["configuracion"],
  roles: ROLES_DUENO,
  capacidadRequerida: "ver_configuracion",
  respuesta: "PanelEnvelope<ConfigCuadres>",
  pendientes: [
    "Varios cuadres comparan cifras derivadas de los mismos pedidos: solo fallan ante un error de cálculo, no ante datos sucios de origen",
    "Si ms-logistics no responde, el stock negativo viene en null con un aviso y los cuadres se entregan igual",
  ],
});
