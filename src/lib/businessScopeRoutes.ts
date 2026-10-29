const businessRoutes = [
  "/dashboard", "/metricas", "/ventas", "/operaciones", "/inventario",
  "/productos", "/packs-promos", "/clientes", "/compras", "/proveedores",
  "/finanzas", "/facturacion", "/atencion-cliente",
];

export function isBusinessScopeRoute(pathname: string) {
  if (pathname === "/metricas/superadmin") return false;
  return businessRoutes.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

export function shouldResetBusinessView(pathname: string) {
  return isBusinessScopeRoute(pathname) && pathname !== "/dashboard" && !pathname.startsWith("/metricas/");
}
