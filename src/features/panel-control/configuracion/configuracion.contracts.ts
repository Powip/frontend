import { defineContract, ROLES_DUENO, ROLES_TODOS } from "../shared/data/contract-helpers";

export const CONFIG_METAS_CONTRACT = defineContract({
  id: "config-metas",
  titulo: "Metas",
  metodo: "GET",
  endpoint: "/config/metas?empresaId=",
  estado: "pendiente",
  pantallas: [
    "configuracion",
    "resumen",
    "canales",
    "callcenter",
    "operaciones",
    "equipo",
    "misventas",
  ],
  filtros: [],
  roles: ROLES_TODOS,
  respuesta: "ConfigMetas",
  pendientes: [
    "Metas por indicador (§11.1), mensuales por canal, vendedora y confirmadora, con vigencia",
    "Mientras no exista, el panel usa las metas por defecto de la especificación marcadas como demo",
  ],
});

export const CONFIG_METAS_GUARDAR_CONTRACT = defineContract({
  id: "config-metas-guardar",
  titulo: "Guardar metas",
  metodo: "PUT",
  endpoint: "/config/metas",
  estado: "pendiente",
  pantallas: ["configuracion"],
  filtros: [],
  roles: ROLES_DUENO,
  capacidadRequerida: "editar_configuracion",
  respuesta: "ConfigMetas",
  pendientes: ["Hoy las metas del mockup se guardan en localStorage; deben persistir por empresa"],
});

export const CONFIG_ESTADOS_CONTRACT = defineContract({
  id: "config-estados",
  titulo: "Conteo actual por estado",
  metodo: "GET",
  endpoint: "/panel/config/estados",
  estado: "pendiente",
  pantallas: ["configuracion"],
  roles: ROLES_DUENO,
  capacidadRequerida: "ver_configuracion",
  respuesta: "ConfigEstados",
  pendientes: [
    "Conteo en los estados de la especificación; requiere la equivalencia con los estados reales de POWIP",
  ],
});

export const CONFIG_CUADRES_CONTRACT = defineContract({
  id: "config-cuadres",
  titulo: "Cuadres y calidad de datos",
  metodo: "GET",
  endpoint: "/panel/config/cuadres",
  estado: "pendiente",
  pantallas: ["configuracion"],
  roles: ROLES_DUENO,
  capacidadRequerida: "ver_configuracion",
  respuesta: "ConfigCuadres",
  pendientes: [
    "Los 9 cuadres de §12 calculados en backend con los mismos filtros",
    "Contradicción abierta: el cuadre 9 (pauta) no cuadra con filtro de canal ni cuando un canal con pauta general no vendió; la especificación exige ✓ con cualquier filtro",
  ],
});
