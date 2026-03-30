// Permissions configuration for route-based access control

export const SUPERADMIN_EMAILS = [
  "octatoledo7@gmail.com",
  "joel@aranni.com.pe",
  "maurimartine01@gmail.com",
];

export const isSuperadmin = (email?: string): boolean => {
  if (!email) return false;
  return SUPERADMIN_EMAILS.includes(email.toLowerCase());
};

// Roles que tienen acceso a configuración
const ADMIN_ROLES = [
  "ADMIN",
  "OWNER",
  "SUPERADMIN",
  "ADMINISTRADOR",
  "admin",
  "owner",
  "administrador",
];

/**
 * Map de rutas a permisos requeridos.
 * Si el array está vacío [], cualquier usuario autenticado puede acceder.
 * "__ADMIN_ROLE__" significa que se verifica el rol del usuario (ADMIN/OWNER).
 */
export const ROUTE_PERMISSIONS: Record<string, string[]> = {
  // Rutas operativas: accesibles para cualquier usuario autenticado
  "/dashboard": [],
  "/productos": [],
  "/inventario": [],
  "/ventas": [],
  "/registrar-venta": [],
  "/operaciones": [],
  "/seguimiento": [],
  "/finanzas": [],
  "/clientes": [],
  "/proveedores": [],
  "/usuarios": [],
  "/couriers": [],
  "/atencion-cliente": [],
  "/facturacion": [],
  // Métricas: accesibles para cualquier usuario autenticado
  "/metricas/ventas": [],
  "/metricas/inventario": [],
  "/metricas/operaciones": [],
  "/metricas/seguimientos": [],
  "/metricas/atencion-cliente": [],
  "/metricas/call-center": [],
  "/metricas/couriers": [],
  "/metricas/clientes": [],
  "/metricas/superadmin": [],
  // Configuración: accesible para todos los autenticados.
  // Las sub-páginas (tiendas, etc.) manejan su propio guard por rol.
  "/configuracion": [],
};

// Map sidebar items to required permissions
export const SIDEBAR_ITEMS_PERMISSIONS: Record<string, string> = {
  Dashboard: "",
  "Crear Productos": "",
  Almacén: "",
  Ventas: "",
  "Registrar venta": "",
  Operaciones: "",
  Seguimiento: "",
  Finanzas: "",
  Clientes: "",
  Proveedores: "",
  Usuarios: "",
  Couriers: "",
  Configuración: "",
  "Atención al cliente": "",
  Facturación: "",
  "Super Admin": "VIEW_SUPER_ADMIN",
};

// Helper function to check if user has required permission
export const hasPermission = (
  userPermissions: string[] | undefined,
  requiredPermission: string,
): boolean => {
  if (!requiredPermission || requiredPermission === "") return true;
  return userPermissions?.includes(requiredPermission) ?? false;
};

// Helper function to check if user has any of the required permissions
export const hasAnyPermission = (
  userPermissions: string[] | undefined,
  requiredPermissions: string[],
): boolean => {
  if (!requiredPermissions.length) return true; // Sin restricción → acceso libre
  return requiredPermissions.some((p) => hasPermission(userPermissions, p));
};

// Verificar si el usuario es admin para rutas de configuración
export const hasAdminAccess = (role?: string): boolean => {
  if (!role) return false;
  return ADMIN_ROLES.includes(role);
};

// Get required permissions for a route
export const getRoutePermissions = (pathname: string): string[] => {
  const route = Object.keys(ROUTE_PERMISSIONS).find(
    (route) => pathname === route || pathname.startsWith(route + "/"),
  );
  return route ? ROUTE_PERMISSIONS[route] : [];
};
