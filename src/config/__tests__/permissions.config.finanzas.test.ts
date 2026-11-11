import { getRoutePermissions, hasRouteAccess } from "../permissions.config";

/**
 * /finanzas y /administracion se abren con el permiso VIEW_FINANCES (no con un rol), para que un
 * administrador pueda delegarlo: si le da el permiso a un usuario, lo ve.
 *
 * Los conjuntos de permisos replican la matriz de prod DESPUÉS de quitarle VIEW_FINANCES al rol
 * CALLER (2026-11-10): solo ADMINISTRADOR lo tiene. Antes, CALLER también lo tenía por defecto, y por eso
 * la regla se había hecho por rol; con el dato corregido, el permiso basta.
 */
const VENTAS = ["VIEW_DASHBOARD", "VIEW_SALES", "CREATE_SALE", "VIEW_TRACKING", "MANAGE_CLIENTS", "VIEW_CUSTOMER_SERVICE"];
const OPERACIONES = [
  "VIEW_DASHBOARD", "MANAGE_PRODUCTS", "MANAGE_ALMACEN", "VIEW_SALES", "MANAGE_OPERATIONS", "VIEW_TRACKING",
  "MANAGE_CLIENTS", "MANAGE_PROVIDERS", "VIEW_CUSTOMER_SERVICE", "VIEW_ABANDONED_CHECKOUTS",
];
const ADMINISTRADOR = [
  ...new Set([...VENTAS, ...OPERACIONES, "VIEW_FINANCES", "APPROVE_PAYMENTS", "MANAGE_USERS", "MANAGE_ROLES", "ACCESS_SETTINGS"]),
];

const user = (role: string, permissions: string[], email = `${role.toLowerCase()}@negocio.invalid`) => ({ email, role, permissions });

const ADMIN = user("ADMINISTRADOR", ADMINISTRADOR);
const ROL_VENTAS = user("VENTAS", VENTAS);
const ROL_OPERACIONES = user("OPERACIONES", OPERACIONES);
// Rol personalizado que combina Ventas + Operaciones (el caso del cliente).
const VENTAS_OPERACIONES = user("CUSTOM_ventas-operaciones", [...new Set([...VENTAS, ...OPERACIONES])]);
// CALLER tal como quedó en prod: sin VIEW_FINANCES.
const CALLER = user("CALLER", [...OPERACIONES, "MANAGE_INVENTORY", "MANAGE_USERS", "MANAGE_ROLES"]);
const SUPERADMIN = user("USUARIO", [], "octatoledo7@gmail.com");

const RUTAS_FINANZAS = ["/finanzas", "/finanzas/", "/finanzas/liquidaciones", "/finanzas/cualquier/subruta"];
const RUTAS_ADMINISTRACION = ["/administracion", "/administracion/resumen", "/administracion/gastos", "/administracion/capital"];
const TODAS = [...RUTAS_FINANZAS, ...RUTAS_ADMINISTRACION];

describe("hasRouteAccess · /finanzas y /administracion por permiso", () => {
  it.each(TODAS)("%s exige el permiso VIEW_FINANCES", (pathname) => {
    expect(getRoutePermissions(pathname)).toEqual(["VIEW_FINANCES"]);
  });

  it.each(TODAS)("quien tiene VIEW_FINANCES (Administrador) entra a %s", (pathname) => {
    expect(hasRouteAccess(pathname, ADMIN)).toBe(true);
  });

  it.each(TODAS)("Ventas, Operaciones, CALLER y el rol personalizado no entran a %s", (pathname) => {
    for (const u of [ROL_VENTAS, ROL_OPERACIONES, VENTAS_OPERACIONES, CALLER]) expect(hasRouteAccess(pathname, u)).toBe(false);
  });

  it.each(TODAS)("DELEGACIÓN: a un caller o a un rol personalizado al que se le da VIEW_FINANCES, %s le abre", (pathname) => {
    expect(hasRouteAccess(pathname, { ...CALLER, permissions: [...CALLER.permissions!, "VIEW_FINANCES"] })).toBe(true);
    expect(hasRouteAccess(pathname, { ...VENTAS_OPERACIONES, permissions: [...VENTAS_OPERACIONES.permissions!, "VIEW_FINANCES"] })).toBe(true);
    expect(hasRouteAccess(pathname, { ...ROL_VENTAS, permissions: ["VIEW_FINANCES"] })).toBe(true);
  });

  it("el rol Administrador sin el permiso no entra: manda el permiso, no el nombre del rol", () => {
    expect(hasRouteAccess("/finanzas", user("ADMINISTRADOR", VENTAS))).toBe(false);
    expect(hasRouteAccess("/administracion/resumen", user("ADMINISTRADOR", []))).toBe(false);
  });

  it("un usuario sin permisos tampoco entra", () => {
    expect(hasRouteAccess("/finanzas", user("USUARIO", []))).toBe(false);
    expect(hasRouteAccess("/finanzas", { email: undefined, role: undefined, permissions: undefined })).toBe(false);
  });

  it("superadmin conserva el acceso", () => {
    expect(hasRouteAccess("/finanzas", SUPERADMIN)).toBe(true);
    expect(hasRouteAccess("/administracion/capital", SUPERADMIN)).toBe(true);
  });

  it("no cierra las rutas vecinas que Ventas y Operaciones usan", () => {
    for (const pathname of ["/ventas", "/registrar-venta", "/operaciones/pedidos", "/facturacion", "/inventario", "/clientes"]) {
      expect(hasRouteAccess(pathname, ROL_VENTAS)).toBe(true);
      expect(hasRouteAccess(pathname, ROL_OPERACIONES)).toBe(true);
    }
  });
});
