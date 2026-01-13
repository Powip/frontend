// Permissions configuration for route-based access control

// Map routes to required permissions
export const ROUTE_PERMISSIONS: Record<string, string[]> = {
  '/dashboard': ['VIEW_DASHBOARD'],
  '/productos': ['MANAGE_PRODUCTS'],
  '/inventario': ['MANAGE_INVENTORY'],
  '/ventas': ['VIEW_SALES'],
  '/registrar-venta': ['CREATE_SALE'],
  '/operaciones': ['MANAGE_OPERATIONS'],
  '/seguimiento': ['VIEW_TRACKING'],
  '/finanzas': ['VIEW_FINANCES'],
  '/clientes': ['MANAGE_CLIENTS'],
  '/proveedores': ['MANAGE_PROVIDERS'],
  '/usuarios': ['MANAGE_USERS'],
  '/configuracion': ['ACCESS_SETTINGS'],
  '/atencion-cliente': ['VIEW_CUSTOMER_SERVICE'],
};

// Map sidebar items to required permissions
export const SIDEBAR_ITEMS_PERMISSIONS: Record<string, string> = {
  'Dashboard': 'VIEW_DASHBOARD',
  'Crear Productos': 'MANAGE_PRODUCTS',
  'Inventario': 'MANAGE_INVENTORY',
  'Ventas': 'VIEW_SALES',
  'Registrar venta': 'CREATE_SALE',
  'Operaciones': 'MANAGE_OPERATIONS',
  'Seguimiento': 'VIEW_TRACKING',
  'Finanzas': 'VIEW_FINANCES',
  'Clientes': 'MANAGE_CLIENTS',
  'Proveedores': 'MANAGE_PROVIDERS',
  'Usuarios': 'MANAGE_USERS',
  'Configuración': 'ACCESS_SETTINGS',
  'Atención al cliente': 'VIEW_CUSTOMER_SERVICE',
};

// Helper function to check if user has required permission
export const hasPermission = (userPermissions: string[] | undefined, requiredPermission: string): boolean => {
  return userPermissions?.includes(requiredPermission) ?? false;
};

// Helper function to check if user has any of the required permissions
export const hasAnyPermission = (userPermissions: string[] | undefined, requiredPermissions: string[]): boolean => {
  return requiredPermissions.some(p => hasPermission(userPermissions, p));
};

// Get required permissions for a route
export const getRoutePermissions = (pathname: string): string[] => {
  const route = Object.keys(ROUTE_PERMISSIONS).find(route => 
    pathname === route || pathname.startsWith(route + '/')
  );
  return route ? ROUTE_PERMISSIONS[route] : [];
};
