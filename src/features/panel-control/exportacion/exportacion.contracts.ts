import { defineContract, ROLES_GESTION } from "../shared/data/contract-helpers";

export const EXPORTACION_LIBRO_CONTRACT = defineContract({
  id: "exportacion-libro",
  titulo: "Excel completo",
  metodo: "GET",
  endpoint: "/panel/export.xlsx",
  estado: "pendiente",
  pantallas: [
    "resumen",
    "canales",
    "callcenter",
    "operaciones",
    "finanzas",
    "equipo",
    "configuracion",
  ],
  roles: ROLES_GESTION,
  capacidadRequerida: "exportar_libro",
  camposRestringidos: ["columnas de costo, margen, ganancia y comisión (solo Dueño)"],
  respuesta: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pendientes: [
    "9 hojas: Resumen, Canales, Pedidos (27 columnas), Productos, Vendedoras, Confirmadoras, Couriers, Departamentos, Cuadres",
    'Cada hoja inicia con título, periodo, filtros y fecha de generación; montos numéricos "S/ "#,##0.00 y porcentajes 0.0%',
    "Nombre sin tildes: powip_panel_AAAA-MM-DD_AAAA-MM-DD.xlsx",
  ],
});

export const COMPARTIR_REPORTE_CONTRACT = defineContract({
  id: "compartir-reporte",
  titulo: "Compartir reporte (WhatsApp)",
  metodo: "GET",
  endpoint: "/panel/compartir",
  estado: "pendiente",
  pantallas: ["resumen"],
  roles: ROLES_GESTION,
  camposRestringidos: ["producto", "ganancia", "gananciaSobreEntregado"],
  respuesta: "CompartirReporteResponse",
  pendientes: [
    "La especificación define dos ganancias en el mismo reporte (sobre facturado y sobre entregado); decidir si ambas se mantienen",
    "Supervisora: confirmar si puede compartir sin las cifras de costo",
  ],
});
