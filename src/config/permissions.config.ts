// Permissions configuration for route-based access control

export const SUPERADMIN_EMAILS: string[] = [
  "octatoledo7@gmail.com",
  "joel@aranni.com.pe",
  "maurimartine01@gmail.com",
  "tognolimauricio@gmail.com",
  "cuentaprueba@gmail.com",
  "marcounobejarano@gmail.com",
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
 * "__INVENTORY_ROLE__" se verifica contra los roles que editan inventario (Administrador y Operaciones).
 * Cualquier otro valor es un permiso del JWT: lo tiene quien su rol (o un administrador) se lo dio.
 */
export const ROUTE_PERMISSIONS: Record<string, string[]> = {
  // Rutas operativas: accesibles para cualquier usuario autenticado
  "/dashboard": [],
  "/productos": [],
  "/inventario": [],
  // Compras: dan de alta stock con costo, así que van con la edición de inventario (Administrador y
  // Operaciones, los únicos roles que las registran en prod). El inventario en sí se sigue viendo.
  "/compras": ["__INVENTORY_ROLE__"],
  "/registrar-compra": ["__INVENTORY_ROLE__"],
  "/ventas": [],
  "/cotizaciones": [],
  "/leads-comerciales": ["VIEW_LEADS", "MANAGE_LEADS", "MANAGE_LEAD_TYPES"],
  "/metricas/leads": ["VIEW_LEADS", "MANAGE_LEADS"],
  "/registrar-venta": [],
  "/operaciones": [],
  "/centro-envios": [],
  "/seguimiento": [],
  // Finanzas: se abre con el permiso VIEW_FINANCES, así un administrador puede delegarlo a quien
  // quiera. Hoy solo lo tiene el rol Administrador: a CALLER se le quitó en la base de datos
  // (2026-11-10), que era lo que antes obligaba a decidir esto por rol. AuthGuard lo aplica a
  // /finanzas y a todas sus subrutas, y el sidebar oculta el enlace con este mismo mapa.
  "/finanzas": ["VIEW_FINANCES"],
  "/clientes": [],
  "/proveedores": [],
  "/usuarios": [],
  "/couriers": [],
  "/atencion-cliente": [],
  "/facturacion": [],
  "/partners/admin/solicitudes": ["PARTNERS_VIEW"],
  "/partners/admin": ["__SUPERADMIN__"],
  "/partners": [],
  // Publicidad v2.2 authorizes its capabilities from the live role matrix.
  "/publicidad": [],
  // Métricas: accesibles para cualquier usuario autenticado
  "/metricas/ventas": [],
  "/metricas/inventario": [],
  "/metricas/operaciones": [],
  "/metricas/seguimientos": [],
  "/metricas/atencion-cliente": [],
  "/metricas/call-center": [],
  "/metricas/couriers": [],
  "/metricas/clientes": [],
  "/metricas/superadmin": ["__SUPERADMIN__"],
  // Configuración: accesible para todos los autenticados.
  // Las sub-páginas (tiendas, etc.) manejan su propio guard por rol.
  "/configuracion": [],
  // Administración financiera (gastos, utilidad, capital, flujo…): mismo permiso que Finanzas. Antes solo
  // se ocultaba en el sidebar y el layout ya pedía VIEW_FINANCES.
  "/administracion": ["VIEW_FINANCES"],
  "/superadmin": ["__SUPERADMIN__"],
};

// Map sidebar items to required permissions
export const SIDEBAR_ITEMS_PERMISSIONS: Record<string, string> = {
  Dashboard: "",
  "Crear Productos": "",
  Almacén: "",
  Ventas: "",
  Cotizaciones: "",
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
  Partners: "",
  Publicidad: "",
  "Partners Admin": "VIEW_PARTNERS_ADMIN",
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

export interface RouteAccessUser {
  email?: string;
  role?: string;
  permissions?: string[];
}

// Rol que edita el inventario además del Administrador. Decisión de Octa (2026-11-10), respaldada con
// prod (90 días): solo Administrador y Operaciones hicieron ajustes manuales de stock y compras.
// Es por ROL y no por permiso: CALLER tiene MANAGE_INVENTORY y VIEW_FINANCES y no debe heredarlos.
const hasInventoryRole = (role?: string): boolean => role?.trim().toUpperCase() === "OPERACIONES";

/** ¿Puede editar el inventario (ajustes, mermas, transferencias, importar Excel, compras)? */
export const canEditInventory = (user?: RouteAccessUser): boolean =>
  !!user && (isSuperadmin(user.email) || hasAdminAccess(user.role) || hasInventoryRole(user.role));

/**
 * ¿Puede ver el costo de los productos (`priceBase`, "Precio Compra")? Los ven Administrador y
 * Operaciones, que son quienes registran compras. Ventas, CALLER, Agentes, Usuario y los roles
 * personalizados no. Un solo lugar para cambiar la regla.
 */
export const canSeeProductCosts = (user?: RouteAccessUser): boolean => canEditInventory(user);

export const hasRouteAccess = (pathname: string, user: RouteAccessUser | undefined): boolean => {
  if (isSuperadmin(user?.email)) return true;
  const requiredPermissions = getRoutePermissions(pathname);
  if (requiredPermissions.includes("__ADMIN_ROLE__")) return hasAdminAccess(user?.role);
  if (requiredPermissions.includes("__INVENTORY_ROLE__")) return canEditInventory(user);
  return hasAnyPermission(user?.permissions, requiredPermissions);
};

// Rutas por permiso cuyo enlace del sidebar se oculta a quien no puede abrirlas.
const SIDEBAR_HIDDEN_WITHOUT_ACCESS = ["/finanzas", "/administracion"];

/**
 * ¿El sidebar debe ocultar el enlace de esta ruta a quien no puede abrirla? Sí para las que se deciden
 * por rol y para las de finanzas (por permiso). No se aplica a todas las rutas con permisos a propósito:
 * Leads y otros enlaces del sidebar ya se deciden con sus propias capacidades.
 */
export const isAccessGatedRoute = (pathname: string): boolean =>
  getRoutePermissions(pathname).some((p) => p === "__ADMIN_ROLE__" || p === "__INVENTORY_ROLE__") ||
  SIDEBAR_HIDDEN_WITHOUT_ACCESS.some((route) => pathname === route || pathname.startsWith(`${route}/`));
