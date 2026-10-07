export const PERMISSION_ACTIONS = ["Ver", "Crear", "Editar", "Eliminar", "Admin"] as const;

export interface PermissionSectionPreview {
  section: string;
  routes: string[];
}

export const MOCKUP_PERMISSION_SECTIONS: PermissionSectionPreview[] = [
  {
    section: "Administración",
    routes: [
      "administrar/roles",
      "administrar/rutas",
      "administrar/puntos",
      "administrar/couriers",
      "administrar/zonas",
      "administrar/usuarios",
      "home",
      "logout",
    ],
  },
  {
    section: "Ventas",
    routes: [
      "ventas/pedidos",
      "ventas/pedido/detalle",
      "ventas/pedido/resumen",
      "ventas/pedidos_items",
      "ventas/preparaciones",
      "ventas/preparaciones_items",
      "ventas/restockaje",
      "ventas/devoluciones",
      "registrar_venta",
    ],
  },
  {
    section: "Operaciones",
    routes: [
      "operaciones/dashboard",
      "operaciones/gestion",
      "operaciones/guias",
      "operaciones/guia/detalle",
      "operaciones/entregados",
      "operaciones/historial",
    ],
  },
  {
    section: "Stock",
    routes: [
      "stock/inventario",
      "stock/producto/detalle",
      "stock/proveedores",
      "stock/almacenes",
      "stock/suministros",
      "stock/salidas",
      "stock/inventario_general",
    ],
  },
  {
    section: "Marketing",
    routes: ["marketing/marcas", "marketing/modelos", "marketing/productos", "marketing/categorias", "marketing/subcategorias"],
  },
  { section: "Contact Center", routes: ["contact_center/administrar", "contact_center/mis_pedidos"] },
  { section: "Estadísticas", routes: ["estadisticas/ventas", "estadisticas/analisis"] },
  { section: "Finanzas", routes: ["finanzas/dashboard", "finanzas/liquidaciones", "finanzas/gastos"] },
];
